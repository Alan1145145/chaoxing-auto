import { h } from 'vue';
import { store } from '../store';
import dayjs from 'dayjs';
import { Message, Modal } from '@arco-design/web-vue';
import { remote } from './remote';
import { notify } from './notify';
import { electron, inBrowser } from './node';
import MarkdownText from '../components/MarkdownText.vue';
import { OCSApi } from '@ocs-desktop/common/src/api';
import { Infos } from '@ocs-desktop/common';
import { NOTICE_ID, NOTICE_MARKDOWN, NOTICE_TITLE } from '../config/notice';

const { ipcRenderer } = electron;

export function sleep(timeout: number) {
	return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * 防抖
 * @param fn 方法
 * @param period 间隔
 */
export function debounce(fn: Function, period: number) {
	let timer: number | null = null;
	return function () {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(fn, period);
	};
}

/**
 * 检测 json 语法
 * @param jsonString json 字符串
 */
export function jsonLint(jsonString: string) {
	try {
		JSON.parse(jsonString);
	} catch (e) {
		const msg = (e as Error).message;
		const match = msg.match(/Unexpected token(.*)in JSON at position (\d+)/);
		const position = parseInt(match?.[2] || '0');
		let count = 0;
		let line = 0;
		for (const str of jsonString.split('\n')) {
			count += str.length + 1;

			if (count >= position) {
				return {
					token: match?.[1],
					line
				};
			}

			line++;
		}
	}
}

export function date(time: number) {
	return dayjs(time).format('YYYY-MM-DD');
}

export function datetime(time: number) {
	return dayjs(time).format('YYYY-MM-DD hh:mm');
}

/**
 * 显示本地公告（使用教程）
 *
 * 原版从 cdn.ocsjs.com 获取远程公告，已改为随软件打包的本地内容，见 config/notice.ts。
 * @param readAll 是否强制显示（帮助菜单「查看公告」）；否则仅在未读时显示
 */
export async function fetchRemoteNotify(readAll: boolean) {
	const storeNotify: any[] = store.render.notifies || [];
	const hasRead = storeNotify.some((item) => item?.id === NOTICE_ID);
	if (!readAll && hasRead) return;

	Modal.confirm({
		title: () => NOTICE_TITLE,
		okText: readAll ? '确定' : '我已阅读',
		cancelText: readAll ? '关闭' : '下次再看',
		hideCancel: false,
		simple: false,
		width: 'auto',
		bodyStyle: {
			maxWidth: '820px'
		},
		content: () =>
			h(MarkdownText, {
				content: NOTICE_MARKDOWN,
				style: {
					maxHeight: '65vh',
					overflow: 'auto'
				}
			}),
		onOk() {
			if (!hasRead) {
				store.render.notifies = [...storeNotify, { id: NOTICE_ID, content: [] }];
			}
		},
		onCancel() {}
	});
}

/**
 * 获取远程语言文件
 */
export async function fetchRemoteLangs() {
	// 已停用：原版会从 cdn.ocsjs.com 下载界面文字（其中包含“前往官网下载最新版本 / 自动更新软件”等原版提示）并覆盖本地文字。
	// 所有 lang() 调用处都有本地默认文字，这里清空旧版缓存的语言包，始终使用本地文字。
	store.render.langs = {};
}

/**
 * 获取 infos.json
 */
let temp_infos: Infos | undefined;
export async function getRemoteInfos() {
	if (temp_infos) {
		return temp_infos;
	}
	temp_infos = await OCSApi.getInfos();
	return temp_infos;
}

/** 下载文件到指定路径 */
export async function download({
	name,
	dest,
	url
}: {
	/** 显示文件名 */
	name: string;
	/** 下载路径 */
	dest: string;
	/** url */
	url: string;
}) {
	const listener = (e: any, channel: string, rate: number, chunkLength: number, totalLength: number) => {
		installListener(name, channel, rate, chunkLength, totalLength);
	};

	// 监听下载进度
	ipcRenderer.on('download', listener);
	try {
		// 下载
		return await remote.methods.call('download', 'download-file-' + name, url, dest);
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	}
	ipcRenderer.removeListener('download', listener);
}

function installListener(name: string, channel: string, rate: number, chunkLength: number, totalLength: number) {
	if (channel === 'download-file-' + name) {
		if (rate === 100) {
			return notify(
				'文件下载',
				`${name} 下载完成: ${(totalLength / 1024 / 1024).toFixed(2)}MB`,
				'download-file-' + name,
				{
					type: 'success',
					duration: 0
				}
			);
		} else {
			return notify(
				'文件下载',
				`${name} 下载中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
				'download-file-' + name,
				{
					type: 'info',
					duration: 0
				}
			);
		}
	}
}

/** 显示软件使用教程（本地内容，原版从 cdn.ocsjs.com 获取） */
export async function about() {
	store.render.state.first = false;
	Modal.info({
		title: NOTICE_TITLE,
		closable: true,
		simple: false,
		maskClosable: false,
		footer: false,
		width: 'auto',
		bodyStyle: {
			maxWidth: '820px'
		},
		content: () =>
			h(MarkdownText, {
				content: NOTICE_MARKDOWN,
				style: {
					maxHeight: '70vh',
					overflow: 'auto'
				}
			})
	});
}

export async function changeTheme() {
	if (inBrowser) {
		if (store.render.setting.theme.dark) document.body.setAttribute('arco-theme', 'dark');
		else document.body.removeAttribute('arco-theme');
		return;
	}
	const platform = await remote.methods.call('getPlatform');
	document.body.classList.add('platform-' + platform);
	if (platform !== 'darwin') {
		if (store.render.setting.theme.dark) {
			// 设置为暗黑主题
			document.body.setAttribute('arco-theme', 'dark');
			remote.win.call('setTitleBarOverlay', {
				color: '#20231e',
				symbolColor: 'white'
			});
		} else {
			// 恢复亮色主题
			document.body.removeAttribute('arco-theme');
			remote.win.call('setTitleBarOverlay', {
				color: '#f0f1ee',
				symbolColor: 'black'
			});
		}
	}
}

export function setAutoLaunch() {
	remote.methods.call('autoLaunch');
}

export function setAlwaysOnTop() {
	remote.win.call('setAlwaysOnTop', store.window.alwaysOnTop);
}

export function size(num: number) {
	return (
		(
			[
				['GB', Math.pow(1024, 3)],
				['MB', Math.pow(1024, 2)],
				['KB', Math.pow(1024, 1)],
				['B', 1]
			] as [string, number][]
		)
			.map((i) => [i[0], Math.floor(num / i[1])])
			.find((i) => parseFloat(i[1].toString()) > 0)
			// @ts-ignore
			?.reduce((pre, cur) => cur + pre)
	);
}

export function errorFilter(str: string) {
	// arco design 问题，暂时无需处理，复现方式，鼠标重复经过 tooltip 或者 dropdown ， 打开 modal 都会出现
	if (str.includes('ResizeObserver loop limit exceeded')) {
		return true;
	}
	//  operation not permitted, stat xxxxx CrashpadMetrics.pma ， 这个是 playwright 问题，暂时无需处理
	if (str.includes('CrashpadMetrics')) {
		return true;
	}
}

export function goto(link: string) {
	window.open(link, '_blank');
}

/** 通过本地服务代理加载图标，解决跨域问题 */
export function iconUrl(url?: string): string {
	if (!url) return '';
	const port = 15319;
	return `http://localhost:${port}/icon?url=${encodeURIComponent(url)}`;
}
