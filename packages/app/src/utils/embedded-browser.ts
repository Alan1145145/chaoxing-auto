import { BrowserWindow, WebContents, session, webContents, webFrameMain } from 'electron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getEmbeddedStorageToken, registerEmbeddedStorage } from './embedded-storage';
import { store } from '../store';

type NetworkRequest = {
	url: string;
	method: string;
	headers: Record<string, string>;
	postData?: string;
};

type NetworkResponse = {
	url: string;
	status: number;
	headers: Record<string, string>;
	body?: string;
};

type NetworkWaiter = {
	kind: 'request' | 'response';
	pattern: RegExp;
	resolve: (value: NetworkRequest | NetworkResponse) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
};

type NetworkState = {
	responses: Map<string, NetworkResponse>;
	waiters: NetworkWaiter[];
	gmBindingName: string;
	gmResponseEvent: string;
	gmAllowedHosts: string[];
	gmBindingRegistered: boolean;
	gmAbortControllers: Map<string, AbortController>;
	scriptInjectionIdentifiers: string[];
	scriptMatchPatterns: string[];
	scriptRuntimeSource?: string;
	inflight: number;
	lastNetworkActivityAt: number;
	debuggerMessageHandler?: (...args: any[]) => void;
	debuggerDetachHandler?: (...args: any[]) => void;
};

const embeddedContents = new Map<string, WebContents>();
const networkStates = new Map<number, NetworkState>();
const mousePositions = new Map<number, { x: number; y: number }>();
const registeredContents = new WeakSet<WebContents>();
const embeddedSyncQueues = new Map<string, Promise<unknown>>();
const debuggerCommandQueues = new Map<number, Promise<void>>();

/** Prepare a dedicated persistent Electron session for an embedded browser profile. */
export async function prepareEmbeddedBrowser(uid: string) {
	assertUid(uid);
	const partition = `persist:ocs-${uid}`;
	registerEmbeddedStorage(uid);
	session.fromPartition(partition);
	return { partition };
}

/** Install the bundled OCSJS userscript into this WebContents without a Chrome extension. */
export async function syncEmbeddedOcsjs(uid: string, enabled: boolean) {
	assertUid(uid);
	const previous = embeddedSyncQueues.get(uid) || Promise.resolve();
	const current = previous.catch(() => undefined).then(() => syncEmbeddedOcsjsNow(uid, enabled));
	embeddedSyncQueues.set(uid, current);
	try {
		return await current;
	} finally {
		if (embeddedSyncQueues.get(uid) === current) embeddedSyncQueues.delete(uid);
	}
}

async function syncEmbeddedOcsjsNow(uid: string, enabled: boolean) {
	const contents = embeddedContents.get(uid);
	if (!contents || isContentsDestroyed(contents)) throw new Error('内嵌网页尚未就绪，请等待页面加载完成后重试。');
	const contentsId = getContentsId(contents);
	const state = contentsId === undefined ? undefined : networkStates.get(contentsId);
	if (!state) throw new Error('内嵌浏览器调试桥尚未就绪，请等待页面加载完成后重试。');

	let script = '';
	let metadata: ParsedUserscriptMetadata | undefined;
	if (enabled) {
		const appRoot = path.resolve(__dirname, '../../..');
		const scriptPath = path.join(appRoot, 'public', 'ocsjs', 'ocs.user.js');
		if (!fs.existsSync(scriptPath)) throw new Error(`OCSJS 本地脚本不存在：${scriptPath}，请先运行 pnpm build:ocsjs。`);
		script = fs.readFileSync(scriptPath, 'utf8');
		metadata = parseUserscriptMetadata(script);
		if (!metadata.match.length) throw new Error('OCSJS 脚本没有可用的 @match 规则。');
	}

	await ensureUserscriptRuntime(contents, state);
	await removeScriptInjections(contents, state);

	if (!enabled || !metadata) {
		const shouldReload = matchesUserscriptUrl(state.scriptMatchPatterns, getCurrentUrl(contents));
		state.gmAllowedHosts = [];
		state.scriptMatchPatterns = [];
		state.scriptRuntimeSource = undefined;
		if (shouldReload) contents.reload();
		return { enabled: false };
	}

	const source = createOcsjsRuntimeSource(script, metadata, state.gmBindingName, state.gmResponseEvent, {
		url: `http://127.0.0.1:${store.store.server.port || 15319}/api/embedded-gm-storage`,
		token: getEmbeddedStorageToken(uid)
	});
	state.scriptRuntimeSource = source;
	const result = await sendDebuggerCommand<{ identifier?: string }>(contents, 'Page.addScriptToEvaluateOnNewDocument', {
		source
	});
	if (result?.identifier) state.scriptInjectionIdentifiers.push(result.identifier);
	state.gmAllowedHosts = metadata.connect;
	state.scriptMatchPatterns = metadata.match;

	const currentUrl = getCurrentUrl(contents);
	if (matchesUserscriptUrl(metadata.match, currentUrl)) contents.reload();
	return { enabled: true, version: metadata.version, matches: metadata.match.length };
}

/** Associate the guest webContents with its browser profile for the OCSJS bridge. */
export function registerEmbeddedWebContents(uid: string, webContentsId: number) {
	assertUid(uid);
	const contents = webContents.fromId(webContentsId);
	if (!contents || contents.isDestroyed()) throw new Error('内嵌网页已关闭，请重新打开浏览器。');
	const contentsId = contents.id;
	const expectedSession = session.fromPartition(`persist:ocs-${uid}`);
	if (contents.session !== expectedSession) throw new Error('浏览器会话不匹配。');

	const previous = embeddedContents.get(uid);
	if (previous && getContentsId(previous) !== contentsId) {
		unregisterContents(previous);
	}
	embeddedContents.set(uid, contents);
	attachNetworkObserver(contents);

	if (!registeredContents.has(contents)) {
		registeredContents.add(contents);
		// 新建课程框架可能没有执行 CDP 的文档启动脚本；加载后补注入，运行器会防止重复启动。
		contents.on('did-frame-finish-load', (_event, _isMainFrame, processId, routingId) => {
			const state = networkStates.get(contentsId);
			const frame = webFrameMain.fromId(processId, routingId);
			if (!state?.scriptRuntimeSource || !frame || !matchesUserscriptUrl(state.scriptMatchPatterns, frame.url)) return;
			void frame.executeJavaScript(state.scriptRuntimeSource).catch((error) => {
				if (!isContentsDestroyed(contents)) console.warn('课程框架脚本加载失败', String(error));
			});
		});
		contents.once('destroyed', () => {
			registeredContents.delete(contents);
			if (getContentsId(embeddedContents.get(uid)) === contentsId) embeddedContents.delete(uid);
			unregisterContents(contents);
		});
	}

	return { uid, webContentsId };
}

export function unregisterEmbeddedBrowser(uid: string) {
	const contents = embeddedContents.get(uid);
	if (contents) unregisterContents(contents);
	embeddedContents.delete(uid);
}

/** Locate the registered embedded page whose current URL matches the script request. */
export function findEmbeddedWebContents(pageUrl: string): WebContents | undefined {
	let target: URL;
	try {
		target = new URL(pageUrl);
	} catch {
		return;
	}

	for (const contents of embeddedContents.values()) {
		if (contents.isDestroyed()) continue;
		try {
			const current = new URL(contents.getURL());
			if (
				current.origin === target.origin &&
				current.pathname === target.pathname &&
				current.search === target.search
			) {
				return contents;
			}
		} catch {}
	}
}

/** 取已注册的内嵌页面。自动化程序只能操作这个页面。 */
export function requireEmbeddedWebContents(uid: string) {
	assertUid(uid);
	const contents = embeddedContents.get(uid);
	if (!contents || isContentsDestroyed(contents)) throw new Error('内嵌网页尚未就绪，请等待页面加载完成后重试。');
	return contents;
}

/** 等待页面发出匹配的响应。供内嵌自动化程序使用。 */
export function waitForEmbeddedResponse(contents: WebContents, matcher: unknown, timeoutMs = 30_000) {
	return waitForNetwork(contents, 'response', matcher, timeoutMs);
}

/** 等到没有进行中的网络请求，并再安静 500 毫秒。 */
export async function waitForEmbeddedNetworkIdle(contents: WebContents, timeoutMs = 30_000) {
	const state = networkStates.get(contents.id);
	if (!state) throw new Error('浏览器网络桥未就绪。');
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (isContentsDestroyed(contents)) throw new Error('浏览器页面已关闭。');
		if (state.inflight <= 0 && Date.now() - state.lastNetworkActivityAt >= 500) return;
		await delay(50);
	}
	throw new Error('等待网络空闲超时');
}

export async function executeEmbeddedBrowserAction(contents: WebContents, property: string, args: any[]) {
	if (contents.isDestroyed()) throw new Error('浏览器页面已关闭。');
	const timeout = Number(args?.[1]?.timeout) || 30_000;

	switch (property) {
		case 'click':
		case 'dblclick':
		case 'tap':
			return clickSelector(contents, args[0], args[1], property === 'dblclick' ? 2 : 1);
		case 'check':
			return checkSelector(contents, String(args[0]));
		case 'fill':
			return fillSelector(contents, String(args[0]), String(args[1] ?? ''));
		case 'inputValue':
			return contents.executeJavaScript(`(() => {
				const element = document.querySelector(${JSON.stringify(String(args[0]))});
				if (!element) throw new Error('元素不存在：' + ${JSON.stringify(String(args[0]))});
				return element.value ?? element.textContent ?? '';
			})()`);
		case 'focus':
			return contents.executeJavaScript(`(() => {
				const element = document.querySelector(${JSON.stringify(String(args[0]))});
				if (!element) throw new Error('元素不存在：' + ${JSON.stringify(String(args[0]))});
				element.focus();
			})()`);
		case 'hover':
			return moveToSelector(contents, String(args[0]));
		case 'selectOption':
			return selectOption(contents, String(args[0]), args[1]);
		case 'waitForSelector':
			return waitForSelectorState(contents, String(args[0]), timeout, args[1]?.state);
		case 'press':
			await contents.executeJavaScript(
				'(() => { const element = document.querySelector(' +
					JSON.stringify(String(args[0])) +
					'); if (!element) throw new Error("元素不存在"); element.focus(); })()'
			);
			return pressKey(contents, String(args[1]), args[2]);
		case 'screenshot': {
			const image = await contents.capturePage();
			return image.toPNG().toString('base64');
		}
		case 'reload':
			contents.reload();
			return 'OK';
		case 'bringToFront':
			BrowserWindow.fromWebContents(contents)?.focus();
			return 'OK';
		case 'waitForRequest':
			return waitForNetwork(contents, 'request', args[0], timeout);
		case 'waitForResponse':
			return waitForNetwork(contents, 'response', args[0], timeout);
		case 'dragAndDrop':
			return dragAndDrop(contents, String(args[0]), String(args[1]));
		case 'setInputFiles':
			throw new Error('内嵌浏览器暂不支持由自动化脚本设置本地文件。');
		case 'keyboard.type':
			contents.insertText(String(args[0] ?? ''));
			return 'OK';
		case 'keyboard.press':
			return pressKey(contents, String(args[0]), args[1]);
		case 'mouse.click':
			return sendMouseClick(contents, Number(args[0]), Number(args[1]), args[2]);
		case 'mouse.dblclick':
			return sendMouseClick(contents, Number(args[0]), Number(args[1]), args[2], 2);
		case 'mouse.move':
			return moveMouse(contents, Number(args[0]), Number(args[1]));
		case 'mouse.down': {
			const point = getMousePosition(contents);
			contents.sendInputEvent({ type: 'mouseDown', ...point, button: normalizeMouseButton(args[0]?.button) });
			return 'OK';
		}
		case 'mouse.up': {
			const point = getMousePosition(contents);
			contents.sendInputEvent({ type: 'mouseUp', ...point, button: normalizeMouseButton(args[0]?.button) });
			return 'OK';
		}
		case 'mouse.wheel': {
			const point = getMousePosition(contents);
			contents.sendInputEvent({
				type: 'mouseWheel',
				...point,
				deltaX: Number(args[0]) || 0,
				deltaY: Number(args[1]) || 0
			});
			return 'OK';
		}
		default:
			throw new Error(`内嵌浏览器不支持此脚本操作：${property}`);
	}
}

async function clickSelector(contents: WebContents, selector: unknown, options: any, clickCount = 1) {
	if (typeof selector !== 'string') throw new Error('点击目标格式不正确。');
	const point = await getElementPoint(contents, selector);
	return sendMouseClick(contents, point.x, point.y, options, clickCount);
}

async function checkSelector(contents: WebContents, selector: string) {
	const state = await contents.executeJavaScript(`(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) throw new Error('元素不存在：' + ${JSON.stringify(selector)});
		if (element.checked) return true;
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	})()`);
	if (state === true) return 'OK';
	return sendMouseClick(contents, state.x, state.y);
}

async function fillSelector(contents: WebContents, selector: string, value: string) {
	return contents.executeJavaScript(`(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) throw new Error('元素不存在：' + ${JSON.stringify(selector)});
		const prototype = Object.getPrototypeOf(element);
		const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
		if (descriptor?.set) descriptor.set.call(element, ${JSON.stringify(value)});
		else element.value = ${JSON.stringify(value)};
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
	})()`);
}

async function selectOption(contents: WebContents, selector: string, option: any) {
	const values = (Array.isArray(option) ? option : [option]).map((item) =>
		typeof item === 'string' ? item : item?.value ?? item?.label ?? ''
	);
	return contents.executeJavaScript(`(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) throw new Error('元素不存在：' + ${JSON.stringify(selector)});
		const values = ${JSON.stringify(values)};
		for (const option of Array.from(element.options || [])) option.selected = values.includes(option.value);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
		return values;
	})()`);
}

async function waitForSelector(contents: WebContents, selector: string, timeout: number) {
	const started = Date.now();
	while (Date.now() - started < timeout) {
		if (contents.isDestroyed()) throw new Error('浏览器页面已关闭。');
		const found = await contents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
		if (found) return 'OK';
		await delay(100);
	}
	throw new Error(`等待元素超时：${selector}`);
}

async function waitForSelectorState(contents: WebContents, selector: string, timeout: number, requestedState?: string) {
	const state = ['attached', 'detached', 'visible', 'hidden'].includes(requestedState || '')
		? requestedState
		: 'visible';
	if (state === 'attached') return waitForSelector(contents, selector, timeout);

	const started = Date.now();
	while (Date.now() - started < timeout) {
		if (contents.isDestroyed()) throw new Error('浏览器页面已关闭。');
		const result = await contents.executeJavaScript(
			'(() => { const element = document.querySelector(' +
				JSON.stringify(selector) +
				'); if (!element) return { exists: false, visible: false }; const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return { exists: true, visible: style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 }; })()'
		);
		const matched = state === 'detached' ? !result.exists : state === 'hidden' ? !result.visible : result.visible;
		if (matched) return 'OK';
		await delay(100);
	}
	throw new Error('等待元素超时：' + selector);
}

async function getElementPoint(contents: WebContents, selector: string) {
	const point = await contents.executeJavaScript(`(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) throw new Error('元素不存在：' + ${JSON.stringify(selector)});
		element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	})()`);
	return { x: Math.round(point.x), y: Math.round(point.y) };
}

async function moveToSelector(contents: WebContents, selector: string) {
	const point = await getElementPoint(contents, selector);
	return moveMouse(contents, point.x, point.y);
}

function sendMouseClick(contents: WebContents, x: number, y: number, options?: any, clickCount = 1) {
	const point = rememberMousePosition(contents, x, y);
	const button = normalizeMouseButton(options?.button);
	contents.sendInputEvent({ type: 'mouseDown', ...point, button, clickCount });
	contents.sendInputEvent({ type: 'mouseUp', ...point, button, clickCount });
	return 'OK';
}

async function dragAndDrop(contents: WebContents, sourceSelector: string, targetSelector: string) {
	const source = await getElementPoint(contents, sourceSelector);
	const target = await getElementPoint(contents, targetSelector);
	contents.sendInputEvent({ type: 'mouseMove', ...rememberMousePosition(contents, source.x, source.y) });
	contents.sendInputEvent({ type: 'mouseDown', ...source, button: 'left' });
	contents.sendInputEvent({ type: 'mouseMove', ...rememberMousePosition(contents, target.x, target.y) });
	contents.sendInputEvent({ type: 'mouseUp', ...target, button: 'left' });
	return 'OK';
}

function moveMouse(contents: WebContents, x: number, y: number) {
	const point = rememberMousePosition(contents, x, y);
	contents.sendInputEvent({ type: 'mouseMove', ...point });
	return 'OK';
}

function rememberMousePosition(contents: WebContents, x: number, y: number) {
	const point = { x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) };
	mousePositions.set(contents.id, point);
	return point;
}

function getMousePosition(contents: WebContents) {
	return mousePositions.get(contents.id) || { x: 0, y: 0 };
}

function normalizeMouseButton(button: unknown): 'left' | 'middle' | 'right' {
	return button === 'right' || button === 'middle' ? button : 'left';
}

async function pressKey(contents: WebContents, key: string, options?: any) {
	const parts = key.split('+');
	const keyCode = parts.pop() || key;
	const modifierNames: Record<string, string> = {
		alt: 'alt',
		control: 'control',
		ctrl: 'control',
		meta: 'meta',
		cmd: 'meta',
		shift: 'shift'
	};
	const modifiers = parts.map((part) => modifierNames[part.toLowerCase()]).filter(Boolean);
	const delayMs = Number(options?.delay) || 0;
	contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers } as any);
	if (delayMs > 0) await delay(delayMs);
	contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers } as any);
	return 'OK';
}

async function waitForNetwork(contents: WebContents, kind: NetworkWaiter['kind'], matcher: unknown, timeoutMs: number) {
	const state = networkStates.get(contents.id);
	if (!state) return Promise.reject(new Error('浏览器网络桥未就绪。'));
	await sendDebuggerCommand(contents, 'Network.enable');
	const pattern = compileNetworkPattern(matcher);

	return new Promise<NetworkRequest | NetworkResponse>((resolve, reject) => {
		const timeout = setTimeout(() => {
			state.waiters = state.waiters.filter((waiter) => waiter.resolve !== resolve);
			reject(new Error(`等待网络${kind === 'request' ? '请求' : '响应'}超时：${pattern}`));
		}, timeoutMs);
		state.waiters.push({ kind, pattern, resolve, reject, timeout });
	});
}

function attachNetworkObserver(contents: WebContents) {
	if (networkStates.has(contents.id)) return;
	const state: NetworkState = {
		responses: new Map(),
		waiters: [],
		gmBindingName: `__ocs_gm_${contents.id}`,
		gmResponseEvent: `__ocs_gm_response_${contents.id}`,
		gmAllowedHosts: [],
		gmBindingRegistered: false,
		gmAbortControllers: new Map(),
		scriptInjectionIdentifiers: [],
		scriptMatchPatterns: [],
		inflight: 0,
		lastNetworkActivityAt: 0
	};
	networkStates.set(contents.id, state);
	try {
		state.debuggerMessageHandler = (_event: unknown, method: string, params: any) => {
			if (method === 'Runtime.bindingCalled' && params.name === state.gmBindingName) {
				void handleGmBinding(contents, state, params);
				return;
			}
			if (method === 'Network.requestWillBeSent') {
				state.inflight += 1;
				state.lastNetworkActivityAt = Date.now();
				const request = params.request;
				const value: NetworkRequest = {
					url: request.url,
					method: request.method,
					headers: request.headers || {},
					postData: request.postData
				};
				notifyNetworkWaiters(state, 'request', value);
			} else if (method === 'Network.responseReceived') {
				const response = params.response;
				state.responses.set(params.requestId, {
					url: response.url,
					status: response.status,
					headers: response.headers || {}
				});
			} else if (method === 'Network.loadingFinished') {
				state.inflight = Math.max(0, state.inflight - 1);
				state.lastNetworkActivityAt = Date.now();
				const response = state.responses.get(params.requestId);
				state.responses.delete(params.requestId);
				if (!response) return;
				if (!hasNetworkWaiter(state, 'response', response.url)) return;
				sendDebuggerCommand(contents, 'Network.getResponseBody', { requestId: params.requestId })
					.then((result: any) => {
						response.body = result.base64Encoded
							? Buffer.from(result.body, 'base64').toString('utf8')
							: String(result.body || '');
						notifyNetworkWaiters(state, 'response', response);
					})
					.catch(() => notifyNetworkWaiters(state, 'response', response));
			} else if (method === 'Network.loadingFailed') {
				state.inflight = Math.max(0, state.inflight - 1);
				state.lastNetworkActivityAt = Date.now();
				state.responses.delete(params.requestId);
			}
		};
		state.debuggerDetachHandler = () => resetDebuggerSessionState(state);
		const debuggerApi = contents.debugger;
		debuggerApi.on('message', state.debuggerMessageHandler);
		debuggerApi.on('detach', state.debuggerDetachHandler);
		if (!debuggerApi.isAttached()) {
			debuggerApi.attach('1.3');
			void sendDebuggerCommand(contents, 'Network.enable').catch((error) => {
				console.warn('WebView 网络观察命令失败', error);
			});
		}
	} catch (error) {
		console.warn('WebView 网络观察不可用', error);
	}
}

async function ensureUserscriptRuntime(contents: WebContents, state: NetworkState) {
	if (isContentsDestroyed(contents)) throw new Error('内嵌网页已关闭，请重新打开浏览器后重试。');
	await sendDebuggerCommand(contents, 'Network.enable');
	await sendDebuggerCommand(contents, 'Runtime.enable');
	await sendDebuggerCommand(contents, 'Page.enable');
	if (!state.gmBindingRegistered) {
		await sendDebuggerCommand(contents, 'Runtime.addBinding', { name: state.gmBindingName });
		state.gmBindingRegistered = true;
	}
}

function resetDebuggerSessionState(state?: NetworkState) {
	if (!state) return;
	state.gmBindingRegistered = false;
	state.scriptInjectionIdentifiers = [];
	state.responses.clear();
}

async function reconnectDebuggerSession(contents: WebContents, contentsId: number) {
	const methods = ['Network.enable', 'Runtime.enable', 'Page.enable'];
	for (let reconnectAttempt = 0; reconnectAttempt < 2; reconnectAttempt++) {
		try {
			if (isContentsDestroyed(contents)) throw new Error('WebContents 已销毁');
			const debuggerApi = contents.debugger;
			if (debuggerApi.isAttached()) {
				try {
					debuggerApi.detach();
				} catch (error) {
					if (debuggerApi.isAttached()) throw error;
				}
			}
			if (isContentsDestroyed(contents)) throw new Error('WebContents 已销毁');
			resetDebuggerSessionState(networkStates.get(contentsId));
			debuggerApi.attach('1.3');
			await delay(120 + reconnectAttempt * 120);
			for (const method of methods) await debuggerApi.sendCommand(method);
			return;
		} catch (error) {
			const transientTargetError = /target closed|session closed|debugger.*disconnected/i.test(getErrorMessage(error));
			if (reconnectAttempt === 0 && transientTargetError && !isContentsDestroyed(contents)) continue;
			throw new Error(`调试器会话重连失败：${getErrorMessage(error)}`);
		}
	}
}

async function removeScriptInjections(contents: WebContents, state: NetworkState) {
	const identifiers = state.scriptInjectionIdentifiers;
	state.scriptInjectionIdentifiers = [];
	for (let index = 0; index < identifiers.length; index++) {
		const identifier = identifiers[index];
		try {
			await sendDebuggerCommand(contents, 'Page.removeScriptToEvaluateOnNewDocument', { identifier });
		} catch (error) {
			state.scriptInjectionIdentifiers.push(...identifiers.slice(index));
			throw error;
		}
	}
}

function sendDebuggerCommand<T = any>(contents: WebContents, method: string, params?: Record<string, any>): Promise<T> {
	const contentsId = getContentsId(contents);
	if (contentsId === undefined) return Promise.reject(new Error(`CDP ${method} 失败：无法读取 WebContents ID。`));

	const previous = debuggerCommandQueues.get(contentsId) || Promise.resolve();
	const current = previous
		.catch(() => undefined)
		.then(() => runDebuggerCommand<T>(contents, contentsId, method, params));
	const settled = current.then(
		() => undefined,
		() => undefined
	);
	debuggerCommandQueues.set(contentsId, settled);
	void settled.then(() => {
		if (debuggerCommandQueues.get(contentsId) === settled) debuggerCommandQueues.delete(contentsId);
	});
	return current;
}

async function runDebuggerCommand<T>(
	contents: WebContents,
	contentsId: number,
	method: string,
	params?: Record<string, any>
): Promise<T> {
	const canRetry = ['Network.enable', 'Runtime.enable', 'Page.enable'].includes(method);
	for (let attempt = 0; attempt < (canRetry ? 2 : 1); attempt++) {
		try {
			if (isContentsDestroyed(contents)) throw new Error('WebContents 已销毁');
			const debuggerApi = contents.debugger;
			if (!debuggerApi.isAttached()) {
				debuggerApi.attach('1.3');
				resetDebuggerSessionState(networkStates.get(contentsId));
			}
			return (await debuggerApi.sendCommand(method, params)) as T;
		} catch (error) {
			const transientTargetError = /target closed|session closed|debugger.*disconnected/i.test(getErrorMessage(error));
			if (attempt === 0 && canRetry && transientTargetError && !isContentsDestroyed(contents)) {
				try {
					await reconnectDebuggerSession(contents, contentsId);
				} catch (reconnectError) {
					throw new Error(`CDP 命令 ${method} 失败（webContentsId=${contentsId}）：${getErrorMessage(reconnectError)}`);
				}
				continue;
			}
			const destroyed = isContentsDestroyed(contents);
			const attached = isDebuggerAttached(contents);
			throw new Error(
				`CDP 命令 ${method} 失败（webContentsId=${contentsId}，页面${destroyed ? '已销毁' : '仍存在'}，调试器${
					attached ? '已连接' : '已断开'
				}）：${getErrorMessage(error)}`
			);
		}
	}
	throw new Error(`CDP 命令 ${method} 失败（webContentsId=${contentsId}）：重试次数已用尽。`);
}

function getContentsId(contents: WebContents | undefined) {
	if (!contents) return undefined;
	try {
		return Number.isInteger(contents.id) ? contents.id : undefined;
	} catch {
		return undefined;
	}
}

function isContentsDestroyed(contents: WebContents) {
	try {
		return contents.isDestroyed();
	} catch {
		return true;
	}
}

function isDebuggerAttached(contents: WebContents) {
	try {
		return !isContentsDestroyed(contents) && contents.debugger.isAttached();
	} catch {
		return false;
	}
}

function getCurrentUrl(contents: WebContents) {
	if (isContentsDestroyed(contents)) throw new Error('内嵌网页已关闭，无法读取当前地址。');
	try {
		return contents.getURL();
	} catch (error) {
		throw new Error(`读取内嵌网页地址失败：${getErrorMessage(error)}`);
	}
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

type ParsedUserscriptMetadata = {
	name: string;
	version: string;
	namespace: string;
	match: string[];
	connect: string[];
};

function parseUserscriptMetadata(source: string): ParsedUserscriptMetadata {
	const header = source.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
	if (!header) throw new Error('OCSJS 文件缺少 UserScript 元数据头。');
	const fields = new Map<string, string[]>();
	for (const line of header[1].split(/\r?\n/)) {
		const match = line.match(/^\s*\/\/\s*@([^\s]+)\s+(.+?)\s*$/);
		if (!match) continue;
		const values = fields.get(match[1]) || [];
		values.push(match[2].trim());
		fields.set(match[1], values);
	}
	return {
		name: fields.get('name')?.[0] || 'OCS 网课助手',
		version: fields.get('version')?.[0] || '0.0.0',
		namespace: fields.get('namespace')?.[0] || 'https://enncy.cn',
		match: fields.get('match') || [],
		connect: fields.get('connect') || []
	};
}

function createOcsjsRuntimeSource(
	source: string,
	metadata: ParsedUserscriptMetadata,
	bindingName: string,
	responseEvent: string,
	storage: { url: string; token: string }
) {
	const header = source.match(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/);
	const body = header ? source.replace(header[0], '') : source;
	const metadataJson = JSON.stringify({
		name: metadata.name,
		version: metadata.version,
		namespace: metadata.namespace,
		match: metadata.match,
		grant: [
			'GM_info',
			'GM_getTab',
			'GM_saveTab',
			'GM_setValue',
			'GM_getValue',
			'unsafeWindow',
			'GM_listValues',
			'GM_deleteValue',
			'GM_notification',
			'GM_xmlhttpRequest',
			'GM_getResourceText',
			'GM_addValueChangeListener',
			'GM_removeValueChangeListener'
		]
	});
	const matchJson = JSON.stringify(metadata.match);

	return `(() => {
	const __ocsPatterns = ${matchJson};
	const __ocsMatches = (pattern, href) => {
		try {
			const url = new URL(href);
			const parts = pattern.split('://');
			if (parts.length !== 2) return false;
			const slash = parts[1].indexOf('/');
			if (slash < 0) return false;
			const scheme = parts[0].toLowerCase();
			if (scheme !== '*' && scheme !== url.protocol.slice(0, -1)) return false;
			const hostPattern = parts[1].slice(0, slash).toLowerCase();
			const hostMatches = hostPattern === '*' || hostPattern.startsWith('*.')
				? hostPattern === '*' || url.hostname === hostPattern.slice(2) || url.hostname.endsWith('.' + hostPattern.slice(2))
				: url.hostname === hostPattern;
			if (!hostMatches) return false;
			const pathPattern = parts[1].slice(slash);
			return pathPattern === '/*' || pathPattern === url.pathname;
		} catch { return false; }
	};
	if (!__ocsPatterns.some((pattern) => __ocsMatches(pattern, location.href))) return;
	const __ocsMeta = ${metadataJson};
	const __ocsRuntimeKey = ${JSON.stringify(bindingName + '_version')};
	if (globalThis[__ocsRuntimeKey] === __ocsMeta.version) return;
	globalThis[__ocsRuntimeKey] = __ocsMeta.version;
	const __ocsBinding = globalThis[${JSON.stringify(bindingName)}];
	const __ocsResponseEvent = ${JSON.stringify(responseEvent)};
	const __ocsStoragePrefix = '__ocs_gm__:' + __ocsMeta.namespace + ':' + __ocsMeta.name + ':';
	const __ocsTabStorageKey = __ocsStoragePrefix + 'tab';
	const __ocsListeners = new Map();
	const __ocsRequests = new Map();
	let __ocsListenerId = 0;
	const __ocsReadJson = (storage, key, fallback) => {
		try { const value = storage.getItem(key); return value === null ? fallback : JSON.parse(value); }
		catch { return fallback; }
	};
	const __ocsDirectStorage = globalThis.__ocsGMStorage;
	const __ocsSharedStorage = __ocsDirectStorage || {
		call(action, key, value) {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', ${JSON.stringify(storage.url)}, false);
			xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
			xhr.send(JSON.stringify({ token: ${JSON.stringify(storage.token)}, action, key, value }));
			if (xhr.status !== 200) throw new Error('课程页面存储桥请求失败：' + xhr.status);
			const response = JSON.parse(xhr.responseText || '{}');
			if (response.error) throw new Error(response.error);
			return response.value;
		}
	};
	const __ocsValueCache = new Map();
	const __ocsGetValue = (key, fallback) => {
		const storageKey = __ocsStoragePrefix + String(key);
		if (__ocsValueCache.has(storageKey)) return __ocsValueCache.get(storageKey);
		const shared = __ocsSharedStorage.call('get', storageKey);
		if (shared !== undefined) { __ocsValueCache.set(storageKey, shared); return shared; }
		if (__ocsSharedStorage.call('has', storageKey)) { __ocsValueCache.set(storageKey, fallback); return fallback; }
		const legacy = __ocsReadJson(localStorage, storageKey, undefined);
		if (legacy !== undefined) { __ocsSharedStorage.call('set', storageKey, legacy); __ocsValueCache.set(storageKey, legacy); return legacy; }
		__ocsValueCache.set(storageKey, fallback);
		return fallback;
	};
	const __ocsEmitChange = (key, oldValue, newValue, remote) => {
		for (const entry of __ocsListeners.values()) {
			if (entry.key === key) {
				try { entry.listener(key, oldValue, newValue, remote); } catch (error) { console.error(error); }
			}
		}
	};

	globalThis.unsafeWindow = globalThis;
	globalThis.GM_info = {
		scriptHandler: 'OCS Embedded',
		script: { name: __ocsMeta.name, version: __ocsMeta.version, namespace: __ocsMeta.namespace, matches: __ocsMeta.match, grants: __ocsMeta.grant }
	};
	globalThis.GM_getValue = (key, fallback) => __ocsGetValue(key, fallback);
	globalThis.GM_setValue = (key, value) => {
		const storageKey = __ocsStoragePrefix + String(key);
		const oldValue = __ocsGetValue(key, undefined);
		__ocsValueCache.set(storageKey, value);
		try { __ocsSharedStorage.call('set', storageKey, value); localStorage.setItem(storageKey, JSON.stringify(value)); __ocsEmitChange(String(key), oldValue, value, false); }
		catch (error) { console.error('OCS GM_setValue failed', error); }
	};
	globalThis.GM_deleteValue = (key) => {
		const oldValue = __ocsGetValue(key, undefined);
		__ocsValueCache.delete(__ocsStoragePrefix + String(key));
		try { __ocsSharedStorage.call('delete', __ocsStoragePrefix + String(key)); localStorage.removeItem(__ocsStoragePrefix + String(key)); __ocsEmitChange(String(key), oldValue, undefined, false); }
		catch (error) { console.error('OCS GM_deleteValue failed', error); }
	};
	globalThis.GM_listValues = () => {
		const keys = __ocsSharedStorage.call('keys', '').filter(key => key.startsWith(__ocsStoragePrefix)).map(key => key.slice(__ocsStoragePrefix.length));
		for (let index = 0; index < localStorage.length; index++) {
			const key = localStorage.key(index);
			if (key && key.startsWith(__ocsStoragePrefix) && key !== __ocsTabStorageKey && !keys.includes(key.slice(__ocsStoragePrefix.length))) keys.push(key.slice(__ocsStoragePrefix.length));
		}
		return keys;
	};
	globalThis.GM_getTab = (callback) => {
		const tab = __ocsReadJson(sessionStorage, __ocsTabStorageKey, {});
		if (typeof callback === 'function') callback(tab);
		return tab;
	};
	globalThis.GM_saveTab = (tab) => {
		try { sessionStorage.setItem(__ocsTabStorageKey, JSON.stringify(tab || {})); }
		catch (error) { console.error('OCS GM_saveTab failed', error); }
	};
	globalThis.GM_addValueChangeListener = (key, listener) => {
		const id = ++__ocsListenerId;
		__ocsListeners.set(id, { key: String(key), listener });
		return id;
	};
	globalThis.GM_removeValueChangeListener = (id) => __ocsListeners.delete(id);
	globalThis.GM_getResourceText = () => '';
	globalThis.GM_notification = (details, title, image, onclick) => {
		const options = typeof details === 'object' && details !== null ? details : { text: String(details || ''), title: String(title || '') };
		if (typeof Notification === 'undefined') return undefined;
		const show = () => {
			try {
				const notification = new Notification(options.title || __ocsMeta.name, { body: options.text || options.body || '', icon: options.image || image });
				if (typeof options.onclick === 'function' || typeof onclick === 'function') notification.onclick = options.onclick || onclick;
				return notification;
			} catch { return undefined; }
		};
		if (Notification.permission === 'granted') return show();
		if (Notification.permission === 'default') Notification.requestPermission().then((permission) => { if (permission === 'granted') show(); }).catch(() => {});
		return undefined;
	};
	globalThis.GM_xmlhttpRequest = (details) => {
		if (typeof __ocsBinding !== 'function') {
			const error = { error: 'OCS GM_xmlhttpRequest bridge is unavailable' };
			queueMicrotask(() => details?.onerror?.(error));
			return { abort() {} };
		}
		const id = String(Date.now()) + '_' + Math.random().toString(36).slice(2);
		__ocsRequests.set(id, details || {});
		__ocsBinding(JSON.stringify({ id, details: {
			url: details?.url,
			method: details?.method || 'GET',
			headers: details?.headers || {},
			data: details?.data,
			responseType: details?.responseType || 'text',
			timeout: details?.timeout || 30000
		} }));
		return { abort: () => { try { __ocsBinding(JSON.stringify({ id, action: 'abort' })); } catch {} } };
	};
	window.addEventListener(__ocsResponseEvent, (event) => {
		const response = event.detail || {};
		const request = __ocsRequests.get(String(response.id));
		if (!request) return;
		__ocsRequests.delete(String(response.id));
		if (response.error) {
			if (response.timeout) request.ontimeout?.({ error: response.error, status: 0 });
			else if (response.aborted) request.onabort?.({ error: response.error, status: 0 });
			else request.onerror?.({ error: response.error, status: 0 });
			return;
		}
		let value = response.responseText;
		if (request.responseType === 'json') {
			try { value = JSON.parse(response.responseText); } catch { value = null; }
		} else if (request.responseType === 'blob' || request.responseType === 'arraybuffer') {
			const binary = atob(response.responseBase64 || '');
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
			value = request.responseType === 'blob' ? new Blob([bytes], { type: response.contentType || '' }) : bytes.buffer;
		} else if (request.responseType === 'document') {
			value = new DOMParser().parseFromString(response.responseText || '', 'text/html');
		}
		request.onload?.({ ...response, response: value, readyState: 4 });
	});
	window.addEventListener('storage', (event) => {
		if (!event.key || !event.key.startsWith(__ocsStoragePrefix) || event.key === __ocsTabStorageKey) return;
		const key = event.key.slice(__ocsStoragePrefix.length);
		__ocsEmitChange(key, __ocsReadJson({ getItem: () => event.oldValue }, key, undefined), __ocsReadJson({ getItem: () => event.newValue }, key, undefined), true);
	});

	try {
		${body}
	} catch (error) {
		console.error('OCSJS 内嵌脚本执行失败', error);
	}
})();`;
}

async function handleGmBinding(contents: WebContents, state: NetworkState, params: any) {
	const executionContextId = Number(params.executionContextId);
	let message: any;
	try {
		message = JSON.parse(String(params.payload || '{}'));
	} catch {
		return;
	}
	const id = String(message.id || '');
	if (!id) return;
	if (message.action === 'abort') {
		state.gmAbortControllers.get(id)?.abort();
		return;
	}

	const details = message.details || {};
	let result: any;
	try {
		const requestUrl = new URL(String(details.url || ''));
		if (!['http:', 'https:'].includes(requestUrl.protocol)) throw new Error('仅允许 HTTP/HTTPS 请求。');
		if (!state.gmAllowedHosts.some((host) => isConnectAllowed(host, requestUrl.hostname))) {
			throw new Error(`OCSJS 未授权请求此域名：${requestUrl.hostname}`);
		}
		const requestMethod = String(details.method || 'GET').toUpperCase();
		if (!['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(requestMethod)) {
			throw new Error(`不支持的请求方法：${requestMethod}`);
		}
		const controller = new AbortController();
		state.gmAbortControllers.set(id, controller);
		const response = await axios.request({
			url: requestUrl.toString(),
			method: requestMethod as any,
			headers: details.headers && typeof details.headers === 'object' ? details.headers : undefined,
			data: details.data,
			timeout: Math.max(1000, Math.min(Number(details.timeout) || 30000, 120000)),
			responseType: 'arraybuffer',
			maxContentLength: 30 * 1024 * 1024,
			maxBodyLength: 30 * 1024 * 1024,
			validateStatus: () => true,
			signal: controller.signal
		});
		const body = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data || '');
		const binary = ['blob', 'arraybuffer'].includes(String(details.responseType));
		result = {
			id,
			status: response.status,
			statusText: response.statusText,
			responseText: body.toString('utf8'),
			responseBase64: binary ? body.toString('base64') : undefined,
			contentType: String(response.headers['content-type'] || ''),
			responseHeaders: Object.entries(response.headers)
				.map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
				.join('\r\n'),
			finalUrl: response.request?.res?.responseUrl || requestUrl.toString()
		};
	} catch (error: any) {
		result = {
			id,
			error: error?.message || String(error),
			timeout: error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT',
			aborted: error?.code === 'ERR_CANCELED'
		};
	} finally {
		state.gmAbortControllers.delete(id);
	}

	if (!isContentsDestroyed(contents) && isDebuggerAttached(contents) && Number.isFinite(executionContextId)) {
		const expression = `window.dispatchEvent(new CustomEvent(${JSON.stringify(
			state.gmResponseEvent
		)}, { detail: ${JSON.stringify(result)} }));`;
		void sendDebuggerCommand(contents, 'Runtime.evaluate', {
			expression,
			contextId: executionContextId,
			returnByValue: true
		}).catch(() => {});
	}
}

function isConnectAllowed(connect: string, hostname: string) {
	const allowed = connect.toLowerCase().trim();
	const host = hostname.toLowerCase();
	return allowed === '*' || allowed === host || host.endsWith(`.${allowed.replace(/^\*\./, '')}`);
}

function matchesUserscriptUrl(patterns: string[], pageUrl: string) {
	return patterns.some((pattern) => {
		try {
			const url = new URL(pageUrl);
			const match = pattern.match(/^(\*|https?|file):\/\/([^/]+)(\/.*)$/i);
			if (!match) return false;
			const scheme = match[1].toLowerCase();
			if (scheme !== '*' && scheme !== url.protocol.slice(0, -1)) return false;
			const hostPattern = match[2].toLowerCase();
			const hostMatches =
				hostPattern === '*' || hostPattern.startsWith('*.')
					? hostPattern === '*' ||
					  url.hostname === hostPattern.slice(2) ||
					  url.hostname.endsWith(`.${hostPattern.slice(2)}`)
					: url.hostname === hostPattern;
			if (!hostMatches) return false;
			const pathPattern = match[3]
				.split('*')
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('.*');
			return new RegExp(`^${pathPattern}$`).test(url.pathname + url.search + url.hash);
		} catch {
			return false;
		}
	});
}

function notifyNetworkWaiters(
	state: NetworkState,
	kind: NetworkWaiter['kind'],
	value: NetworkRequest | NetworkResponse
) {
	const matched = state.waiters.filter(
		(waiter) => waiter.kind === kind && testNetworkPattern(waiter.pattern, value.url)
	);
	for (const waiter of matched) {
		clearTimeout(waiter.timeout);
		state.waiters.splice(state.waiters.indexOf(waiter), 1);
		waiter.resolve(value);
	}
}

function hasNetworkWaiter(state: NetworkState, kind: NetworkWaiter['kind'], url: string) {
	return state.waiters.some((waiter) => waiter.kind === kind && testNetworkPattern(waiter.pattern, url));
}

function testNetworkPattern(pattern: RegExp, url: string) {
	pattern.lastIndex = 0;
	return pattern.test(url);
}

function compileNetworkPattern(matcher: unknown) {
	if (matcher instanceof RegExp) return new RegExp(matcher.source, matcher.flags);
	const matcherObject = matcher && typeof matcher === 'object' ? (matcher as any) : undefined;
	const isRegex = typeof matcherObject?.__ocsRegex === 'string';
	const patternText =
		typeof matcher === 'string' ? matcher : isRegex ? matcherObject.__ocsRegex : matcherObject?.source;
	try {
		return new RegExp(patternText || '.*', isRegex ? String(matcherObject.flags || '') : '');
	} catch {
		return new RegExp(String(patternText || '.*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	}
}

function unregisterContents(contents: WebContents) {
	const contentsId = getContentsId(contents);
	if (contentsId === undefined) return;
	const state = networkStates.get(contentsId);
	networkStates.delete(contentsId);
	if (state) {
		for (const waiter of state.waiters.splice(0)) {
			clearTimeout(waiter.timeout);
			waiter.reject(new Error('浏览器页面已关闭。'));
		}
		state.responses.clear();
		for (const controller of state.gmAbortControllers.values()) {
			try {
				controller.abort();
			} catch {}
		}
		state.gmAbortControllers.clear();
		state.scriptInjectionIdentifiers = [];
	}
	mousePositions.delete(contentsId);
	debuggerCommandQueues.delete(contentsId);

	if (!isContentsDestroyed(contents)) {
		try {
			const debuggerApi = contents.debugger;
			if (state?.debuggerMessageHandler) debuggerApi.removeListener('message', state.debuggerMessageHandler);
			if (state?.debuggerDetachHandler) debuggerApi.removeListener('detach', state.debuggerDetachHandler);
			if (debuggerApi.isAttached()) debuggerApi.detach();
		} catch {}
	}
}

function assertUid(uid: string) {
	if (!/^[a-z\d-]{1,100}$/i.test(uid)) throw new Error('浏览器标识无效。');
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
