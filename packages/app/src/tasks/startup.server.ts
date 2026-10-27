import express from 'express';
import { Logger } from '../logger';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { store } from '../store';
import { getDecryptedRenderData } from '../crypto';
import { getCurrentWebContents, getProjectPath, moveWindowToTop } from '../utils';
import { canOCR, det, ocr } from '../utils/ocr';
import { randomUUID } from 'crypto';
import { executeEmbeddedBrowserAction, findEmbeddedWebContents } from '../utils/embedded-browser';
import { getQuestionBankStatus, queryQuestionBank } from '../services/question-bank';
import { performEmbeddedStorageByToken } from '../utils/embedded-storage';
const logger = Logger('server');

/** 图标内存缓存 */
const iconCache = new Map<string, { data: Buffer; contentType: string }>();
const ICON_CACHE_MAX = 200;

/** 从 URL 中提取域名 */
function extractDomain(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

/** 默认网站图标（地球 SVG），所有源都取不到时返回，避免出现空白图标 */
const FALLBACK_ICON = {
	data: Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#86909c" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
		'utf8'
	),
	contentType: 'image/svg+xml'
};

/**
 * 校验 buffer 是否为可解析的图片数据。
 * 通过文件头魔数判定常见图片格式，避免把 HTML 404 页等非图片内容当作图标返回。
 */
function isImageBuffer(data: Buffer, contentType: string): boolean {
	if (!data || data.length < 4) return false;

	// PNG: 89 50 4E 47
	if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
	// JPEG: FF D8 FF
	if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
	// GIF: 47 49 46 38 (GIF8)
	if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return true;
	// BMP: 42 4D
	if (data[0] === 0x42 && data[1] === 0x4d) return true;
	// ICO: 00 00 01 00
	if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) return true;
	// WEBP: RIFF....WEBP
	if (
		data.length >= 12 &&
		data[0] === 0x52 &&
		data[1] === 0x49 &&
		data[2] === 0x46 &&
		data[3] === 0x46 &&
		data[8] === 0x57 &&
		data[9] === 0x45 &&
		data[10] === 0x42 &&
		data[11] === 0x50
	) {
		return true;
	}
	// SVG（文本）：以 <?xml 或 <svg 开头，或 content-type 声明为 svg
	const head = data.slice(0, 256).toString('utf8').trimStart().toLowerCase();
	if (head.startsWith('<?xml') || head.startsWith('<svg') || contentType.toLowerCase().includes('svg')) {
		return true;
	}
	// 兜底：content-type 明确是图片
	if (contentType.toLowerCase().startsWith('image/')) return true;
	return false;
}

/** 通用请求头：部分图标服务器会按 UA 重定向或返回非图标内容，统一带浏览器 UA */
const ICON_REQUEST_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
	Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
};

/** 请求某个 URL 的图片数据，返回可解析图片或 null */
async function tryFetchImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
	try {
		const response = await axios.get(url, {
			responseType: 'arraybuffer',
			timeout: 3000,
			// 允许跟随重定向（部分图标地址会 301/302 到真实图片，Google Favicon 也会 302）
			maxRedirects: 5,
			headers: ICON_REQUEST_HEADERS
		});
		const contentType = response.headers['content-type'] || 'image/png';
		return isImageBuffer(response.data, contentType) ? { data: response.data, contentType } : null;
	} catch {
		return null;
	}
}

/**
 * 获取网站图标 — 多源降级策略：
 * 原始 URL → 站点自带 favicon.ico → 第三方 favicon 服务 → Google Favicon API → 降级图标
 * 原始 URL 常为站点首页（返回 HTML），因此优先尝试站点 /favicon.ico（国内最稳），
 * 再依次尝试第三方服务与 Google（部分地区不可达），最终降级。
 */
async function fetchIcon(iconUrl: string): Promise<{ data: Buffer; contentType: string }> {
	const candidates: string[] = [iconUrl];

	const domain = extractDomain(iconUrl);
	if (domain) {
		// 站点自带 favicon.ico，国内可达性最好
		candidates.push(`https://${domain}/favicon.ico`);
		candidates.push(`http://${domain}/favicon.ico`);
		// 第三方可达的 favicon 服务
		candidates.push(`https://icons.duckduckgo.com/ip3/${domain}.png`);
		candidates.push(`https://api.iowen.cn/favicon/${domain}.png`);
		// Google Favicon（接口会 302 重定向到真实图标，部分地区不可达）
		candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
	}

	for (const url of candidates) {
		const result = await tryFetchImage(url);
		if (result) return result;
	}

	return FALLBACK_ICON;
}

export async function startupServer() {
	const app = express();

	store.set('server', {
		port: 15319,
		authToken: randomUUID().replace(/-/g, '')
	});

	app.use((req, res, next) => {
		res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'unknown');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, request-id, if-none-match, auth-token');
		res.setHeader('Access-Control-Allow-Methods', '*');
		if (req.method === 'OPTIONS') {
			res.sendStatus(204);
			return;
		}
		next();
	});
	// 解析 post 数据
	app.use(express.urlencoded({ extended: false, limit: '10mb' }));
	app.use(express.json({ limit: '10mb' }));

	app.get('/state', (req, res) => {
		res.json({
			public: path.join(getProjectPath(), './public'),
			project: getProjectPath()
		});
	});

	app.get('/ocs-global-setting', (req, res) => {
		const render = getDecryptedRenderData(store);
		res.json(render?.setting?.ocs || { store: {}, openSync: false });
	});

	/** OCSJS bridge environment probe for embedded and standalone browsers. */
	app.get('/ocs-environment', (req, res) => {
		const pageUrl = String(req.query.page || '');
		res.json({
			environment: 'playwright',
			remoteActions: pageUrl && findEmbeddedWebContents(pageUrl) ? 'webview' : 'playwright'
		});
	});

	/** 获取 browser 数据 */
	app.get('/browser', (req, res) => {
		const render = getDecryptedRenderData(store);
		// 如果开启了同步配置，就返回，否则返回空对象
		const data = render?.setting?.ocs?.openSync ? render?.setting?.ocs?.store : {};
		res.json(data);
	});

	app.get('/is-browser-config-sync', (req, res) => {
		const render = getDecryptedRenderData(store);
		res.end(String(render?.setting?.ocs?.openSync === true));
	});

	/** 脚本操作 */
	app.get('/ocs-script-actions', (req, res) => {
		res.json({ allow: true });
	});

	app.post('/ocs-script-actions', async (req, res) => {
		if (req.headers['auth-token'] !== store.store.server.authToken) {
			res.status(401).send('Invalid OCS action key');
			return;
		}

		const { page, property, args } = req.body || {};
		if (typeof page !== 'string' || typeof property !== 'string' || !Array.isArray(args)) {
			res.status(400).send('Invalid OCS action request');
			return;
		}

		const contents = findEmbeddedWebContents(page);
		if (!contents) {
			res.status(404).send('Embedded browser page not found');
			return;
		}

		try {
			const result = await executeEmbeddedBrowserAction(contents, property, args);
			if (property === 'waitForRequest' || property === 'waitForResponse' || property === 'reload') {
				res.json(result);
			} else if (property === 'screenshot') {
				res.send(result);
			} else {
				res.send(typeof result === 'string' ? result : JSON.stringify(result ?? 'OK'));
			}
		} catch (error) {
			res.status(500).send(error instanceof Error ? error.message : String(error));
		}
	});

	app.get('/get-actions-key', (req, res) => {
		res.send(store.store.server.authToken);
	});

	const sendQuestionBankQuery = async (req: express.Request, res: express.Response) => {
		// 与 ZError 的 /query 一样：课程脚本直接 GET/POST 题目，不要求额外密钥。
		const input = req.method === 'GET' ? req.query : req.body;
		if (req.method === 'GET' && String(input?.test) === 'true') {
			try {
				res.json({ code: 1, data: getQuestionBankStatus() });
			} catch (error) {
				res.json({ code: 0, message: error instanceof Error ? error.message : String(error) });
			}
			return;
		}

		const title = typeof input?.title === 'string' ? input.title : '';
		if (!title.trim()) {
			res.json({ code: 0, message: '题目内容不能为空。' });
			return;
		}

		let imageValues = input?.images;
		if (typeof imageValues === 'string') {
			try {
				imageValues = JSON.parse(imageValues);
			} catch {
				imageValues = [];
			}
		}
		const images = Array.isArray(imageValues)
			? imageValues.filter((image: unknown): image is string => typeof image === 'string')
			: [];

		try {
			const result = await queryQuestionBank({
				title,
				options: typeof input?.options === 'string' ? input.options : '',
				type: typeof input?.type === 'string' ? input.type : '',
				images
			});
			res.json({
				code: 1,
				data: {
					id: result.id,
					question: result.question,
					answer: result.answer,
					is_ai: result.source === 'ai',
					is_pending_correction: result.source === 'ai'
				}
			});
		} catch (error) {
			res.json({ code: 0, message: error instanceof Error ? error.message : String(error) });
		}
	};

	app.get('/query', sendQuestionBankQuery);
	app.post('/query', sendQuestionBankQuery);

	app.get('/api/question-bank/status', (req, res) => {
		if (req.headers['auth-token'] !== store.store.server.authToken) {
			res.status(401).json({ status: 'error', message: 'Invalid OCS action key' });
			return;
		}
		try {
			res.json(getQuestionBankStatus());
		} catch (error) {
			res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
		}
	});

	app.post('/api/question-bank/query', sendQuestionBankQuery);

	/** 获取浏览器信息（供导航页主动获取） */
	app.get('/api/bookmark/browser-info', (req, res) => {
		const uid = req.query.uid as string;
		if (!uid) {
			res.status(400).json({ error: '缺少 uid 参数' });
			return;
		}
		const render = getDecryptedRenderData(store);
		const root = render?.browser?.root;
		if (!root) {
			res.json(null);
			return;
		}
		// 递归查找浏览器
		function findBrowser(children: any): any {
			for (const key in children) {
				if (Object.prototype.hasOwnProperty.call(children, key)) {
					const entity = children[key];
					if (entity.type === 'browser' && entity.uid === uid) {
						return entity;
					} else if (entity.type === 'folder' && entity.children) {
						const found = findBrowser(entity.children);
						if (found) return found;
					}
				}
			}
			return null;
		}
		const browser = findBrowser(root.children || {});
		if (!browser) {
			res.json(null);
			return;
		}
		res.json({
			uid: browser.uid,
			name: browser.name || '',
			notes: browser.notes || '',
			tags: browser.tags || []
		});
	});

	/** 获取网站图标（带内存缓存） */
	app.get('/icon', async (req, res) => {
		const iconUrl = req.query.url as string;
		if (!iconUrl) {
			res.status(400).send('Missing url parameter');
			return;
		}

		// 查缓存
		const cached = iconCache.get(iconUrl);
		if (cached) {
			res.setHeader('Content-Type', cached.contentType);
			res.setHeader('Cache-Control', 'public, max-age=86400');
			res.send(cached.data);
			return;
		}

		// 缓存未命中，走三级降级获取
		const result = await fetchIcon(iconUrl);

		// 写入缓存（降级图标也缓存，避免重复降级）
		if (iconCache.size >= ICON_CACHE_MAX) {
			const firstKey = iconCache.keys().next().value;
			if (firstKey !== undefined) iconCache.delete(firstKey);
		}
		iconCache.set(iconUrl, result);

		res.setHeader('Content-Type', result.contentType);
		res.setHeader('Cache-Control', 'public, max-age=86400');
		res.send(result.data);
	});

	/** 请求转发 */
	app.post('/proxy', async (req, res) => {
		const { method, url, data, headers } = req.body || {};
		axios
			.request({
				method,
				url,
				data,
				headers
			})
			.then(({ data }) => {
				res.send(data);
			})
			.catch((err) => {
				res.send(err);
			});
	});

	app.get(/\/ocs-action_.+/, (req, res) => {
		res.send('正在执行脚本 : ' + req.path + ' 请勿操作。');
	});

	// ocr 验证码破解
	app.post('/ocr', async (req, res) => {
		const base64 = req.body.image?.toString();
		const det_target = req.body.det_target?.toString();
		const det_bg = req.body.det_bg?.toString();

		if (canOCR()) {
			try {
				if (base64) {
					res.json({ canOCR: true, code: await ocr(base64) });
				} else if (det_target && det_bg) {
					res.json({ canOCR: true, det: await det(det_target, det_bg) });
				} else {
					res.send({ error: '参数缺失!' });
				}
			} catch (err) {
				res.json({ canOCR: true, error: err });
			}
		} else {
			res.json({ canOCR: false });
		}
	});

	app.get('/api/bookmark/show-browser-in-app', (req, res) => {
		moveWindowToTop();
		// 显示浏览器文件
		getCurrentWebContents().send('show-browser-in-app', req.query.uid);
	});

	/** 课程 iframe 没有主页面预加载桥时，用同步请求读写同一份脚本设置。 */
	app.post('/api/embedded-gm-storage', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
		let body: { token?: unknown; action?: unknown; key?: unknown; value?: unknown };
		try {
			body = JSON.parse(typeof req.body === 'string' ? req.body : '');
		} catch {
			res.status(400).json({ error: '请求格式不正确' });
			return;
		}
		try {
			const value = performEmbeddedStorageByToken(
				String(body.token || ''),
				String(body.action || ''),
				String(body.key ?? ''),
				body.value
			);
			res.json({ value });
		} catch (error) {
			res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
		}
	});

	/** Serve the locally built OCSJS userscript to the embedded browser's script manager. */
	app.get('/api/embedded-ocsjs.user.js', (_req, res) => {
		const scriptPath = path.join(getProjectPath(), 'public', 'ocsjs', 'ocs.user.js');
		if (!fs.existsSync(scriptPath)) {
			res.status(503).send('OCSJS 5 本地脚本尚未生成，请先运行 pnpm build:ocsjs。');
			return;
		}
		res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.sendFile(scriptPath);
	});

	app.get('/api/embedded-ocsjs.meta.js', (_req, res) => {
		const metaPath = path.join(getProjectPath(), 'public', 'ocsjs', 'ocs.meta.js');
		if (!fs.existsSync(metaPath)) {
			res.status(503).send('OCSJS 5 本地脚本尚未生成，请先运行 pnpm build:ocsjs。');
			return;
		}
		res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.sendFile(metaPath);
	});

	// 提供本地用户脚本（扩展只能拦截 http/https 请求安装脚本）
	app.get('/api/local-userscript', (req, res) => {
		const requestedPath = typeof req.query.path === 'string' ? path.resolve(req.query.path) : '';
		const render = getDecryptedRenderData(store);
		const isRegisteredLocalScript =
			!!requestedPath &&
			Array.isArray(render?.scripts) &&
			render.scripts.some((script: any) => {
				if (!script?.isLocalScript) return false;
				return [script.url, script.info?.code_url].some(
					(scriptPath) => typeof scriptPath === 'string' && path.resolve(scriptPath) === requestedPath
				);
			});

		if (!isRegisteredLocalScript || !fs.existsSync(requestedPath)) {
			res.status(404).send('File not found');
			return;
		}

		try {
			if (!fs.statSync(requestedPath).isFile()) {
				res.status(404).send('File not found');
				return;
			}
			res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
			res.setHeader('Cache-Control', 'no-store');
			res.setHeader('X-Content-Type-Options', 'nosniff');
			res.sendFile(requestedPath);
		} catch {
			res.status(404).send('File not found');
		}
	});

	// 静态资源
	app.use(express.static(path.join(getProjectPath(), './public')));

	return new Promise<void>((resolve, reject) => {
		const server = app.listen(store.store.server.port, () => {
			const address = server.address();
			if (address && typeof address === 'object') {
				// 存储本次服务的端口
				logger.info(`OCS服务启动成功 => ${address.port}`);
			}
			resolve();
		});

		// eslint-disable-next-line no-undef
		server.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				logger.error(`端口 ${store.store.server.port} 已被占用，服务启动失败`);
			} else {
				logger.error(`OCS服务启动失败: ${err.message}`);
			}
			reject(err);
		});
	});
}
