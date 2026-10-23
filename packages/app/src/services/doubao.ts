import { app, BrowserWindow, session } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import net from 'net';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { encryptRenderString, decryptRenderString } from '../crypto';

export const DOUBAO_PROVIDER_ID = 'builtin-doubao';
const models = ['doubao-fast', 'doubao-expert', 'doubao-auto', 'doubao-turbo', 'doubao-pro', 'doubao-2.1-lite'];
let child: ChildProcess | undefined;
let starting: Promise<void> | undefined;
let baseUrl = '';
let key = '';
let loginWindow: BrowserWindow | undefined;
let loginError = '';
let accountGeneration = 0;
let chatting = false;

function credentialFile() {
	return path.join(app.getPath('userData'), 'doubao', 'session.enc');
}
function readCookie() {
	return fs.existsSync(credentialFile()) ? decryptRenderString(fs.readFileSync(credentialFile(), 'utf8')) : '';
}
function saveCookie(cookie: string) {
	fs.mkdirSync(path.dirname(credentialFile()), { recursive: true });
	const temp = credentialFile() + '.tmp';
	fs.writeFileSync(temp, encryptRenderString(cookie), 'utf8');
	fs.renameSync(temp, credentialFile());
}
function request(method: 'GET' | 'POST' | 'DELETE', route: string, data?: unknown) {
	return axios
		.request({
			method,
			url: baseUrl + route,
			data,
			proxy: false,
			headers: { Authorization: `Bearer ${key}` },
			timeout: route.includes('completions') ? 120000 : 30000
		})
		.catch((error) => {
			const detail = error.response?.data?.error?.message;
			if (typeof detail === 'string') throw new Error(detail.slice(0, 300));
			// 不再吞掉真实原因：区分网关未响应（被拦截/已退出）和网关返回的异常状态。
			const reason = error.response
				? `HTTP ${error.response.status}`
				: `${error.code || ''} ${String(error.message || '')}`.trim();
			const exited = child ? '' : '（豆包网关进程已退出，可能被杀毒软件拦截，详见日志目录 doubao-gateway.log）';
			throw new Error(`豆包本地服务请求失败：${reason}${exited}，请重试。`.slice(0, 400));
		});
}
async function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const port = (server.address() as net.AddressInfo).port;
			server.close(() => resolve(port));
		});
	});
}
/** 网关 stderr 只写入本机日志用于排错；写入前脱敏，避免记录 Cookie/会话字段。 */
function gatewayLogFile() {
	return path.join(app.getPath('logs'), 'doubao-gateway.log');
}
function redact(text: string) {
	return text
		.replace(/(cookie|authorization|sessionid|sid_tt|sid_guard|uid_tt|ttwid|passport_csrf_token|token)([^\n]{0,4}[=:]\s*)[^\s;,&"']+/gi, '$1$2***')
		.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
		.replace(/\/login\/qr\/[^\s"']+/g, '/login/qr/***');
}
function appendGatewayLog(text: string) {
	try {
		fs.mkdirSync(path.dirname(gatewayLogFile()), { recursive: true });
		if (fs.existsSync(gatewayLogFile()) && fs.statSync(gatewayLogFile()).size > 2 * 1024 * 1024)
			fs.renameSync(gatewayLogFile(), gatewayLogFile() + '.old');
		fs.appendFileSync(gatewayLogFile(), redact(text));
	} catch {}
}
async function boot() {
	const source = path.resolve(__dirname, '../../../vendor/doubao');
	const runtime = path.join(
		source,
		'runtime',
		'doubao-gateway',
		process.platform === 'win32' ? 'doubao-gateway.exe' : 'doubao-gateway'
	);
	if (app.isPackaged && !fs.existsSync(runtime))
		throw new Error(
			`内置豆包网关文件缺失：${runtime}。通常是被杀毒软件隔离/删除，请把软件安装目录加入杀毒软件信任区后重新安装。`
		);
	const port = await freePort();
	key = randomBytes(32).toString('hex');
	baseUrl = `http://127.0.0.1:${port}`;
	let failed = '';
	const processHandle = spawn(
		fs.existsSync(runtime) ? runtime : process.env.DOUBAO_PYTHON || 'python',
		fs.existsSync(runtime) ? [] : [path.join(source, 'desktop.py')],
		{
			windowsHide: true,
			stdio: ['ignore', 'ignore', 'pipe'],
			env: {
				...process.env,
				DOUBAO_DESKTOP: '1',
				PYTHONUTF8: '1',
				PORT: String(port),
				API_KEY: key,
				DOUBAO_COOKIE: readCookie()
			}
		}
	);
	child = processHandle;
	// Never forward raw child output to the UI: upstream errors may include authentication details.
	// It is only kept, redacted, in the local log file for troubleshooting.
	appendGatewayLog(`\n[${new Date().toISOString()}] start ${runtime} port=${port}\n`);
	processHandle.stderr?.on('data', (data) => appendGatewayLog(String(data)));
	processHandle.on('error', (error: NodeJS.ErrnoException) => {
		appendGatewayLog(`[spawn error] ${error.code || ''} ${error.message}\n`);
		failed = app.isPackaged
			? `豆包网关无法启动（${error.code || error.message}）。可能被杀毒软件或系统安全策略拦截，请将软件安装目录加入信任区后重试。`
			: '豆包运行环境启动失败，请构建内置网关或配置 Python 3.10+ 和 Flask。';
		if (child === processHandle) { child = undefined; baseUrl = ''; }
	});
	processHandle.on('exit', (code, signal) => {
		appendGatewayLog(`[exit] code=${code} signal=${signal}\n`);
		failed = failed || `豆包网关启动后已退出（退出码 ${code ?? signal}），可能被杀毒软件拦截，详见日志目录 doubao-gateway.log。`;
		if (child === processHandle) {
			child = undefined;
			baseUrl = '';
		}
	});
	for (let attempt = 0; attempt < 120; attempt++) {
		if (failed) throw new Error(failed);
		try {
			await axios.get(baseUrl + '/health', { proxy: false, timeout: 500 });
			return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	processHandle.kill();
	throw new Error('豆包网关启动超时。');
}
export async function ensureDoubao() {
	if (starting) return starting;
	if (child && baseUrl) return;
	starting = boot().finally(() => {
		starting = undefined;
	});
	return starting;
}
export async function getDoubaoStatus() {
	await ensureDoubao();
	const { data } = await request('GET', '/health');
	return { running: true, loggedIn: Boolean(data.ok), models, loginError };
}
export async function startDoubaoQr() {
	await ensureDoubao();
	const { data } = await request('POST', '/login/qr');
	return { token: String(data.token), image: String(data.qrcode_data_uri) };
}
export async function pollDoubaoQr(token: string) {
	if (!token || token.length > 1024) throw new Error('无效的扫码会话。');
	const generation = accountGeneration;
	await ensureDoubao();
	const { data } = await request('GET', '/login/qr/' + encodeURIComponent(token));
	if (data.confirmed && generation === accountGeneration) {
		const result = await request('GET', '/desktop/session');
		if (generation === accountGeneration) saveCookie(result.data.cookie);
	}
	return {
		status: String(data.status),
		confirmed: Boolean(data.confirmed && generation === accountGeneration),
		ready: Boolean(data.client_ready)
	};
}
export async function importDoubaoCookie(cookie: string) {
	if (!cookie || cookie.length > 65536 || /[\r\n]/.test(cookie)) throw new Error('请输入有效的 Cookie 单行文本。');
	const generation = ++accountGeneration;
	await ensureDoubao();
	await request('POST', '/desktop/session', { cookie });
	if (generation !== accountGeneration) throw new Error('登录操作已取消，请重新登录。');
	saveCookie(cookie);
	loginError = '';
	return getDoubaoStatus();
}
export async function openDoubaoLogin() {
	await ensureDoubao();
	if (loginWindow && !loginWindow.isDestroyed()) {
		loginWindow.focus();
		return;
	}
	loginError = '';
	const loginSession = session.fromPartition('persist:doubao-login');
	const win = new BrowserWindow({
		width: 1000,
		height: 760,
		title: '豆包 · 官方登录',
		autoHideMenuBar: true,
		webPreferences: { session: loginSession, nodeIntegration: false, contextIsolation: true, sandbox: true }
	});
	loginWindow = win;
	const isOfficial = (url: string) => {
		try {
			const u = new URL(url);
			return u.protocol === 'https:' && (u.hostname === 'doubao.com' || u.hostname.endsWith('.doubao.com'));
		} catch {
			return false;
		}
	};
	win.webContents.on('will-navigate', (event, url) => {
		if (!isOfficial(url)) event.preventDefault();
	});
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (isOfficial(url)) win.loadURL(url).catch(() => {});
		return { action: 'deny' };
	});
	let collecting = false;
	const collect = async () => {
		if (collecting || win.isDestroyed()) return;
		collecting = true;
		try {
			const cookies = await loginSession.cookies.get({ url: 'https://www.doubao.com/' });
			const required = [
				'sessionid',
				'sessionid_ss',
				'sid_tt',
				'sid_guard',
				'uid_tt',
				'uid_tt_ss',
				'ttwid',
				'passport_csrf_token'
			];
			if (!required.every((name) => cookies.some((cookie) => cookie.name === name && cookie.value))) return;
			await importDoubaoCookie(cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '));
			if (!win.isDestroyed()) win.close();
		} catch {
			loginError = '网页登录凭据同步失败，可重试或使用扫码登录。';
		} finally {
			collecting = false;
		}
	};
	loginSession.cookies.on('changed', collect);
	win.webContents.on('did-finish-load', collect);
	win.on('closed', () => {
		loginSession.cookies.removeListener('changed', collect);
		loginWindow = undefined;
	});
	await win.loadURL('https://www.doubao.com/chat/');
}
export async function logoutDoubao() {
	accountGeneration++;
	loginWindow?.close();
	await starting?.catch(() => {});
	if (fs.existsSync(credentialFile())) fs.unlinkSync(credentialFile());
	// Restart to invalidate every pending QR session and in-flight upstream request.
	const previous = child;
	child = undefined;
	baseUrl = '';
	previous?.kill();
	await session.fromPartition('persist:doubao-login').clearStorageData();
	loginError = '';
	return getDoubaoStatus();
}
export async function chatDoubao(input: { prompt: string; model?: string; conversationId?: string }) {
	if (!input.prompt?.trim() || input.prompt.length > 30000) throw new Error('请输入 1–30000 字的问题。');
	if (chatting) throw new Error('豆包正在回答，请等待当前回答完成。');
	if (input.model && !models.includes(input.model)) throw new Error('不支持的豆包模型。');
	chatting = true;
	try {
		await ensureDoubao();
		const { data } = await axios.post(
			baseUrl + '/v1/chat/completions',
			{
				model: input.model || 'doubao-fast',
				messages: [{ role: 'user', content: input.prompt }],
				stream: false
			},
			{
				proxy: false,
				timeout: 120000,
				headers: {
					Authorization: `Bearer ${key}`,
					...(input.conversationId ? { 'X-Doubao-Conversation-Id': input.conversationId } : {})
				}
			}
		);
		const content = data.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || !content.trim()) throw new Error('豆包未返回有效回答。');
		return { content, conversationId: String(data.doubao?.conversation_id || '') };
	} catch (error: any) {
		// Do not serialize AxiosError: its config contains the private bearer token.
		const message = error.response?.data?.error?.message;
		throw new Error(typeof message === 'string' ? message.slice(0, 300) : '豆包请求失败，请检查登录状态和网络后重试。');
	} finally {
		chatting = false;
	}
}
app.on('before-quit', () => {
	child?.kill();
});
// The existing desktop close flow uses app.exit(), which skips before-quit.
process.on('exit', () => {
	child?.kill();
});
