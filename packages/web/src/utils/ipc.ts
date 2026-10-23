import { UpdateInformationResource } from '@ocs-desktop/common';
import { store } from '../store';
import { electron } from '../utils/node';
import { notify } from './notify';
const { ipcRenderer } = electron;

export function activeIpcRenderListener() {
	/** 如果正在更新的话，获取更新进度 */
	ipcRenderer.on('update-download', (e, rate, totalLength, chunkLength) => {
		notify(
			'软件更新程序',
			`更新中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
			'updater',
			{
				type: 'info',
				duration: 0,
				close: false
			}
		);
	});

	// 显示浏览器
	ipcRenderer.on('show-browser-in-app', (e, uid) => {
		store.render.browser.currentBrowserUid = uid;
	});

	// 在线更新已关闭：即使收到“检测到新版本”消息也不再弹出更新确认框，避免用原版 OCS Desktop 覆盖本软件。
	ipcRenderer.on('detect-new-app-version', (e, new_version: UpdateInformationResource) => {
		console.log('detect-new-app-version（在线更新已关闭，已忽略）', new_version?.tag);
	});
}
