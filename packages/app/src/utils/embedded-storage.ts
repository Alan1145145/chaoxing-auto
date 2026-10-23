import { app, ipcMain, session } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { decryptRenderString, encryptRenderString } from '../crypto';

const profiles = new Map<Electron.Session, string>();
const storageTokens = new Map<string, string>();
let registered = false;

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
	if (!/^[a-z\d-]{1,100}$/i.test(profile)) throw new Error('浏览器标识无效');
	const directory = path.join(app.getPath('userData'), 'embedded-settings');
	const file = path.join(directory, `${profile}.json`);
	const values: Record<string, unknown> = fs.existsSync(file)
		? JSON.parse(decryptRenderString(fs.readFileSync(file, 'utf8')))
		: {};
	if (typeof key !== 'string' || key.length > 2048) throw new Error('设置键无效');
	const deleted = (candidate: unknown) =>
		candidate !== null && typeof candidate === 'object' && (candidate as any).__ocsDeleted === true;
	if (action === 'get') return deleted(values[key]) ? undefined : values[key];
	if (action === 'has') return Object.prototype.hasOwnProperty.call(values, key);
	if (action === 'keys') return Object.keys(values).filter((item) => !deleted(values[item]));
	if (action === 'set' || action === 'delete') {
		if (action === 'set')
			Object.defineProperty(values, key, { value, writable: true, enumerable: true, configurable: true });
		else
			Object.defineProperty(values, key, {
				value: { __ocsDeleted: true },
				writable: true,
				enumerable: true,
				configurable: true
			});
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(`${file}.tmp`, encryptRenderString(JSON.stringify(values)), 'utf8');
		fs.renameSync(`${file}.tmp`, file);
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
