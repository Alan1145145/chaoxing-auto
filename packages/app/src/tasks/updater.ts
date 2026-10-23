import { app, dialog } from 'electron';
import { Logger } from '../logger';
import { UpdateInformationResource } from '@ocs-desktop/common';

const logger = Logger('updater');

/**
 * 在线更新已关闭。
 *
 * 原版会从 OCS 官方服务器（cdn.ocsjs.com）读取版本列表，发现更高版本后下载原版压缩包并
 * 直接覆盖安装目录。超星自动机是修改版（版本号从 1.0.0 重新开始），原版 2.x 必然“更新”，
 * 会用原版覆盖本软件，因此这里不再联网检查，也不再执行任何下载/覆盖。
 * 新版本请通过超星自动机安装包手动安装。
 */
export async function updater() {
	logger.info('在线更新已关闭，跳过版本检查', app.getVersion());
}

/** 保留接口以兼容旧的渲染层调用，但不会下载或覆盖任何文件。 */
export async function updateApp(newVersion?: UpdateInformationResource) {
	logger.warn('已拒绝在线更新请求（在线更新已关闭）', newVersion?.tag);
	// @ts-ignore
	await dialog.showMessageBox(null, {
		title: '软件更新程序',
		message: '超星自动机已关闭在线更新，不会下载或覆盖安装任何版本。\n如需新版本，请使用超星自动机安装包手动安装。',
		type: 'info',
		noLink: true
	});
	return false;
}
