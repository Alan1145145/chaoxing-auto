import { app, ipcMain, session, webContents } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { decryptRenderString, encryptRenderString } from '../crypto';

const profiles = new Map<Electron.Session, string>();
const storageTokens = new Map<string, string>();
let registered = false;
type ProfileCache = { values: Record<string, unknown>; file: string; dirty: boolean; timer?: ReturnType<typeof setTimeout>; changes: Record<string, unknown>; broadcast?: ReturnType<typeof setTimeout> };
const caches = new Map<string, ProfileCache>();
const isDeleted = (value: unknown) => value !== null && typeof value === 'object' && (value as any).__ocsDeleted === true;

function profileCache(profile: string): ProfileCache {
	if (!/^[a-z\d-]{1,100}$/i.test(profile)) throw new Error('浏览器标识无效');
	let cached = caches.get(profile);
	if (!cached) {
		const file = path.join(app.getPath('userData'), 'embedded-settings', `${profile}.json`);
		const values = fs.existsSync(file) ? JSON.parse(decryptRenderString(fs.readFileSync(file, 'utf8'))) : {};
		cached = { file, values, dirty: false, changes: Object.create(null) };
		caches.set(profile, cached);
	}
	return cached;
}

function flushProfile(cache: ProfileCache) {
	if (cache.timer) clearTimeout(cache.timer);
	cache.timer = undefined;
	if (!cache.dirty) return;
	fs.mkdirSync(path.dirname(cache.file), { recursive: true });
	fs.writeFileSync(`${cache.file}.tmp`, encryptRenderString(JSON.stringify(cache.values)), 'utf8');
	fs.renameSync(`${cache.file}.tmp`, cache.file);
	cache.dirty = false;
}

export function flushEmbeddedStorage() {
	for (const cache of caches.values()) flushProfile(cache);
}

function scheduleChanges(profile: string, cache: ProfileCache, key: string, value: unknown) {
	cache.dirty = true;
	cache.changes[key] = value;
	if (!cache.timer) cache.timer = setTimeout(() => {
		try { flushProfile(cache); } catch (error) { console.error('课程配置保存失败', String(error)); }
	}, 150);
	if (!cache.broadcast) cache.broadcast = setTimeout(() => {
		cache.broadcast = undefined;
		const changes = cache.changes;
		cache.changes = Object.create(null);
		const script = `window.dispatchEvent(new CustomEvent('ocs-gm-values-changed', { detail: ${JSON.stringify(changes)} }));`;
		for (const contents of webContents.getAllWebContents()) {
			if (contents.isDestroyed() || profiles.get(contents.session) !== profile) continue;
			try {
				for (const frame of contents.mainFrame.framesInSubtree) void frame.executeJavaScript(script).catch(() => undefined);
			} catch { /* A tab may close while the batch is being delivered. */ }
		}
	}, 30);
}

app.on('before-quit', flushEmbeddedStorage);
process.on('exit', () => {
	try { flushEmbeddedStorage(); } catch (error) { console.error('退出时保存课程配置失败', String(error)); }
});

/** 课程内嵌框架没有主页面的预加载桥，用这个令牌走本地接口读写同一份设置。 */
export function getEmbeddedStorageToken(uid: string) {
	const existing = storageTokens.get(uid);
	if (existing) return existing;
	const token = randomUUID().replace(/-/g, '');
	storageTokens.set(uid, token);
	return token;
}

export function performEmbeddedStorageByToken(token: string, action: string, key: string, value?: unknown) {
	const profile = Array.from(storageTokens.entries()).find(([, item]) => item === token)?.[0];
	if (!profile) throw new Error('存储令牌无效');
	return performEmbeddedStorage(profile, action, key, value);
}

export function performEmbeddedStorage(profile: string, action: string, key: string, value?: unknown) {
	const cache = profileCache(profile);
	const values = cache.values;
	if (typeof key !== 'string' || key.length > 2048) throw new Error('设置键无效');
	if (action === 'snapshot') return { ...values };
	if (action === 'get') return isDeleted(values[key]) ? undefined : values[key];
	if (action === 'has') return Object.prototype.hasOwnProperty.call(values, key);
	if (action === 'keys') return Object.keys(values).filter((item) => !isDeleted(values[item]));
	if (action === 'set' || action === 'delete') {
		const next = action === 'delete' ? { __ocsDeleted: true } : value;
		if (Object.prototype.hasOwnProperty.call(values, key) && JSON.stringify(values[key]) === JSON.stringify(next)) return true;
		Object.defineProperty(values, key, { value: next, writable: true, enumerable: true, configurable: true });
		scheduleChanges(profile, cache, key, next);
		return true;
	}
	throw new Error('设置操作无效');
}

export function registerEmbeddedStorage(uid: string) {
	profiles.set(session.fromPartition(`persist:ocs-${uid}`), uid);
	if (registered) return;
	registered = true;
	ipcMain.on('ocs-embedded-storage', (event, action: string, key: string, value?: unknown) => {
		try {
			const profile = profiles.get(event.sender.session);
			if (!profile) throw new Error('未注册的浏览器会话');
			event.returnValue = { value: performEmbeddedStorage(profile, action, key, value) };
		} catch (error) {
			event.returnValue = { error: String(error) };
		}
	});
}
