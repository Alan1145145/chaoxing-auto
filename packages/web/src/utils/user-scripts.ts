import { Message } from '@arco-design/web-vue';
import { remote } from './remote';
import { store, StoreUserScript } from '../store';
import { electron } from './node';

/**
 * 添加并且解析本地脚本
 */
export function addScriptFromFile() {
	remote.dialog
		.call('showOpenDialog', {
			title: '选择脚本文件，后缀必须为 (.user.js)',
			buttonLabel: '添加脚本',
			filters: [{ extensions: ['user.js'], name: '用户脚本' }]
		})
		.then(async ({ canceled, filePaths }) => {
			if (canceled === false && filePaths.length) {
				const text = await remote.fs.call('readFileSync', filePaths[0], { encoding: 'utf8' });
				await addLocalScript(filePaths[0], text.toString());
			}
		});
}

async function addLocalScript(uri: string, text: string) {
	if (await remote.fs.call('existsSync', uri)) {
		const metadata = getMetadataFromScript(text);
		if (metadata === undefined) {
			Message.error('脚本格式不正确，请选择能够解析的用户脚本。');
		} else {
			if (store.render.scripts.find((s) => s.url === uri)) {
				Message.warning('当前脚本已安装。');
			} else {
				const id = Date.now();
				store.render.scripts.push({
					id,
					url: uri,
					enable: true,
					isLocalScript: true,
					isInternetLinkScript: false,
					info: {
						id,
						url: uri,
						code_url: uri,
						ratings: 0,
						total_installs: 0,
						daily_installs: 0,
						create_time: 0,
						update_time: 0,
						...metadata
					}
				});
			}
		}
	} else {
		Message.warning('文件不存在。');
	}
}

export async function addScriptFromUrl(url: string) {
	if (store.render.scripts.find((s) => s.url === url)) {
		Message.success('当前脚本已安装。');
		return false;
	}

	if (url.startsWith('http')) {
		const text = await remote.methods.call('get', url);
		const metadata = getMetadataFromScript(text);
		if (metadata === undefined) {
			Message.error('脚本格式不正确，请选择能够解析的用户脚本。');
		} else {
			const id = Math.round(Math.random() * 10000000000000);
			store.render.scripts.push({
				id: id,
				url: url,
				enable: true,
				isLocalScript: false,
				isInternetLinkScript: true,
				info: {
					id,
					url: url,
					code_url: url,
					ratings: 0,
					total_installs: 0,
					daily_installs: 0,
					create_time: 0,
					update_time: 0,
					...metadata
				}
			});
		}
	} else {
		Message.error('脚本链接无效，必须是以 http 开头的网络链接。');
		return false;
	}

	return true;
}

function getMetadataFromScript(text: string) {
	const metadata = text.match(/\/\/\s+==UserScript==([\s\S]+)\/\/\s+==\/UserScript==/)?.[1] || '';

	if (metadata === '') {
		return undefined;
	} else {
		const metadataList = (metadata.match(/\/\/\s+@(.+?)\s+(.*?)(?:\n|$)/g) || []).map((line) => {
			const words = line.match(/[\S]+/g) || [];
			return {
				key: (words[1] || '').replace('@', ''),
				value: words.slice(2).join(' ')
			};
		});

		// 解析函数
		const getMetadata = (key: string) => {
			return metadataList.filter((l) => l.key === key).map((l) => l.value);
		};

		return {
			authors: getMetadata('author').map((a) => ({ name: a, url: '' })) || [],
			description: getMetadata('description')[0],
			license: getMetadata('license')[0],
			name: getMetadata('name')[0],
			version: getMetadata('version')[0]
		};
	}
}

export function openScriptSource(script: StoreUserScript) {
	if (script.info) {
		if (script.info.url.startsWith('http')) {
			window.open(script.info.url, '_blank');
		} else {
			electron.shell.openPath(script.info.url);
		}
	}
}

type BuiltinUserScript = {
	/** 本地服务器路径，用于识别和更新旧条目 */
	path: string;
	name: string;
	version: string;
	description: string;
	license: string;
	author: string;
};

/**
 * 随软件内置的用户脚本。
 * 外部 Chrome 走「用户脚本工具箱 → 启动时自动安装到脚本管理器」这条链路，
 * 因此 OCS 与 U校园刷课助手都必须在这里预置，否则浏览器里不会有任何脚本。
 */
const BUILTIN_USERSCRIPTS: BuiltinUserScript[] = [
	{
		path: '/api/embedded-ocsjs.user.js',
		name: 'OCS 网课助手',
		version: '5.1.3',
		description: 'OCS 网课助手（本地构建，含学习强国、超星等平台脚本）',
		license: 'MIT',
		author: 'enncy'
	}
];

/**
 * 确保内置脚本在「我的脚本」列表中，并把地址更新为当前本地服务器端口。
 * 这样浏览器启动时脚本管理器会自动安装/更新它们。
 */
export async function ensureBuiltinUserScripts() {
	const port = Number(store.server.port) || 15319;
	const scripts = store.render.scripts;
	let changed = false;
	for (const builtin of BUILTIN_USERSCRIPTS) {
		const url = `http://127.0.0.1:${port}${builtin.path}`;
		const existing = scripts.find(
			(script) =>
				(script.url || '').includes(builtin.path) ||
				(script.info?.code_url || '').includes(builtin.path) ||
				(builtin.path.includes('ocsjs') && /ocs\.user\.js(\?|$)/.test(script.url || ''))
		);
		if (existing) {
			if (existing.url !== url) {
				existing.url = url;
				changed = true;
			}
			if (existing.info && existing.info.code_url !== url) {
				existing.info.code_url = url;
				existing.info.url = url;
				changed = true;
			}
			if (existing.info) {
				if (existing.info.version !== builtin.version) {
					existing.info.version = builtin.version;
					changed = true;
				}
				if (existing.info.name !== builtin.name) {
					existing.info.name = builtin.name;
					changed = true;
				}
			}
			if (existing.enable !== true) {
				existing.enable = true;
				changed = true;
			}
			continue;
		}
		const id = Date.now() + Math.floor(Math.random() * 1000);
		scripts.push({
			id,
			url,
			enable: true,
			isLocalScript: false,
			isInternetLinkScript: true,
			info: {
				id,
				url,
				code_url: url,
				name: builtin.name,
				version: builtin.version,
				description: builtin.description,
				license: builtin.license,
				authors: [{ name: builtin.author, url: '' }],
				ratings: 0,
				daily_installs: 0,
				total_installs: 0,
				create_time: Date.now(),
				update_time: Date.now()
			}
		});
		changed = true;
	}
	if (changed) {
		try {
			await remote.methods.call(
				'saveStore',
				JSON.stringify(store),
				remote.methods.callSync('isEncryptionAvailable')
			);
		} catch (error) {
			console.warn('保存内置脚本列表失败', error);
		}
	}
	return changed;
}
