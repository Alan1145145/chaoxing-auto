import { app, BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { NsisUpdater } from 'electron-updater';
import { AppUpdateController, AppUpdateState, UpdateDriver } from '../services/app-update';
import { flushEmbeddedStorage } from '../utils/embedded-storage';
import { Logger } from '../logger';

export const UPDATE_REPOSITORY = { provider: 'github' as const, owner: 'Alan1145145', repo: 'chaoxing-auto', private: false };
const logger = Logger('updater');
let controller: AppUpdateController | undefined;

/** Only an acknowledgement from our own main renderer can authorize installation. */
export function prepareUpdateInstall(window: BrowserWindow, timeoutMs = 20_000) {
	return new Promise<void>((resolve, reject) => {
		if (window.isDestroyed() || window.webContents.isDestroyed()) return reject(new Error('Main window closed'));
		const requestId = randomUUID();
		const senderId = window.webContents.id;
		const cleanup = () => { clearTimeout(timeout); ipcMain.removeListener('app-update-prepared', acknowledge); };
		const acknowledge = (event: Electron.IpcMainEvent, response: { requestId: string; ok: boolean }) => {
			if (event.sender.id !== senderId || response?.requestId !== requestId) return;
			cleanup();
			if (response.ok !== true) return reject(new Error('Data was not saved'));
			try { flushEmbeddedStorage(); resolve(); } catch (error) { reject(error); }
		};
		const timeout = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for saved data')); }, timeoutMs);
		ipcMain.on('app-update-prepared', acknowledge);
		window.webContents.send('app-update-prepare', requestId);
	});
}

/** Tests inject a driver; production always uses this repository's NSIS feed. */
export function initializeUpdater(window: BrowserWindow, options?: { driver: UpdateDriver; prepare?: () => Promise<void> }) {
	let driver: UpdateDriver | undefined = options?.driver;
	if (!options && app.isPackaged && process.platform === 'win32') {
		const native = new NsisUpdater(UPDATE_REPOSITORY);
		native.autoDownload = false;
		native.autoInstallOnAppQuit = false;
		native.allowPrerelease = false;
		native.allowDowngrade = false;
		native.logger = { info: (...args) => logger.info(...args), warn: (...args) => logger.warn(...args), error: (...args) => logger.error(...args) };
		driver = native;
	}
	controller = new AppUpdateController(driver, app.getVersion(), (state) => {
		if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('app-update-state', state);
	}, options?.prepare || (() => prepareUpdateInstall(window)));
	return controller;
}

export function startUpdateChecks(window: BrowserWindow) {
	if (!app.isPackaged || process.platform !== 'win32') return;
	const first = setTimeout(() => { void checkForAppUpdates(); }, 6000);
	const periodic = setInterval(() => { void checkForAppUpdates(); }, 4 * 60 * 60 * 1000);
	first.unref(); periodic.unref();
	window.once('closed', () => { clearTimeout(first); clearInterval(periodic); });
}
export function getAppUpdateState(): AppUpdateState {
	return controller?.getState() || { phase: 'unsupported', currentVersion: app.getVersion(), percent: 0, total: 0, transferred: 0 };
}
export async function checkForAppUpdates() { return controller ? controller.check() : getAppUpdateState(); }
export async function startAppUpdate() { return controller ? controller.start() : getAppUpdateState(); }
export function cancelAppUpdate() { return controller?.cancel() || getAppUpdateState(); }
export function isInstallingUpdate() { return controller?.installing || false; }
// Legacy callers cannot supply a URL/version or enable the original OCS feed.
export async function updateApp() { return startAppUpdate(); }
