// @ts-check
import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';

export function createWindow() {
	const win = new BrowserWindow({
		title: '超星自动机',
		icon: path.join(app.getAppPath(), 'public/favicon.ico'),
		minWidth: 700,
		minHeight: 400,
		width: 1360,
		height: 900,
		center: true,
		hasShadow: true,
		autoHideMenuBar: true,
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: 'white',
			symbolColor: 'black'
		},
		frame: false,
		show: false,
		webPreferences: {
			zoomFactor: 1,
			// 主窗口内嵌的课程网页使用 Electron WebView。
			webviewTag: true,
			// 关闭拼写矫正
			spellcheck: false,
			webSecurity: true,
			// 开启node
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	win.webContents.on('will-attach-webview', (event, webPreferences) => {
		// 网页内容不继承主窗口的 Node.js 权限。
		webPreferences.preload = path.join(__dirname, 'embedded-preload.js');
		webPreferences.nodeIntegration = false;
		webPreferences.contextIsolation = true;
		webPreferences.sandbox = true;
		webPreferences.backgroundThrottling = false;
		webPreferences.webSecurity = true;
	});

	win.webContents.on('did-attach-webview', (_event, guestWebContents) => {
		const send = (channel: string, payload: Record<string, unknown>) => {
			if (!win.isDestroyed()) win.webContents.send(channel, { sourceId: guestWebContents.id, ...payload });
		};
		guestWebContents.on('before-input-event', (event, input) => {
			if (input.type !== 'keyDown') return;
			const key = input.key.toLowerCase();
			if (((input.control || input.meta) && ['t', 'w', 'l', 'r'].includes(key)) || key === 'f5' || (input.alt && ['arrowleft', 'arrowright', 'home'].includes(key))) {
				event.preventDefault();
				send('embedded-browser-shortcut', { key, alt: input.alt });
			}
		});
		guestWebContents.on('context-menu', (_event, params) => {
			const items: Electron.MenuItemConstructorOptions[] = [];
			if (/^https?:\/\//i.test(params.linkURL)) items.push({ label: '在新标签页打开链接', click: () => send('embedded-browser-open-tab', { url: params.linkURL }) });
			items.push({ role: 'copy' }, { role: 'paste' }, { label: '后退', enabled: guestWebContents.canGoBack(), click: () => guestWebContents.goBack() }, { label: '前进', enabled: guestWebContents.canGoForward(), click: () => guestWebContents.goForward() }, { label: '刷新', click: () => guestWebContents.reload() });
			Menu.buildFromTemplate(items).popup({ window: win });
		});
		guestWebContents.setWindowOpenHandler(({ url }) => {
			let destination: URL;
			try {
				destination = new URL(url);
			} catch {
				return { action: 'deny' };
			}

			if (destination.protocol === 'http:' || destination.protocol === 'https:') {
				send('embedded-browser-open-tab', { url: destination.href });
			} else if (destination.protocol === 'mailto:' || destination.protocol === 'tel:') {
				void shell.openExternal(destination.href).catch((error) => {
					console.warn(`打开外部链接失败：${String(error)}`);
				});
			}

			return { action: 'deny' };
		});
	});

	win.webContents.on('will-navigate', (event, url) => {
		// 允许应用内部导航（开发服务器或本地文件），避免 Vite 热更新整页刷新时打开浏览器
		if (url.startsWith('http://localhost') || url.startsWith('file://')) {
			return;
		}
		event.preventDefault();
		shell.openExternal(url);
	});

	win.webContents.setWindowOpenHandler((detail) => {
		shell.openExternal(detail.url);
		return {
			action: 'deny'
		};
	});

	return win;
}
