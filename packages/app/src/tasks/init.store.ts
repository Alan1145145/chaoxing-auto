// @ts-check

import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { OriginalAppStore, store } from '../store';
import { valid, coerce, clean, eq, SemVer } from 'semver';
import defaultsDeep from 'lodash/defaultsDeep';
import { Logger } from '../logger';
import path from 'path';

const logger = Logger('store-init');

/**
 * 初始化配置
 */
export function initStore() {
	const version = store.store.version;
	logger.log('version', version);

	if (typeof version === 'string') {
		// 当前app版本
		const appVersion = parseVersion(app.getVersion());
		// 本地存储的app版本
		const originVersion = parseVersion(version);
		// 版本号变化时补全新增的默认设置（defaultsDeep 只补缺失项，不覆盖用户设置）。
		// 超星自动机版本号从 1.0.0 重新开始，旧版存储的 2.12.0 比当前版本“高”，所以这里用“不相等”判断，
		// 并记录当前版本，避免以后的 1.x 升级永远不补全默认设置。
		if (!eq(appVersion, originVersion)) {
			store.store = defaultsDeep(store.store, OriginalAppStore);
			store.set('version', app.getVersion());
		}
	}
	//  初始化
	else {
		const render = store.store.render ? JSON.parse(JSON.stringify(store.store.render)) : {};
		OriginalAppStore.render = render;
		// 初始化设置
		store.store = OriginalAppStore;

		logger.log('store', store.store);
	}

	/**
	 * 如果浏览器缓存为空，则初始化，如果不为空那就是用户自己设置了
	 */
	if (!store.store.paths.userDataDirsFolder) {
		OriginalAppStore.paths.userDataDirsFolder = path.resolve(app.getPath('userData'), './userDataDirs');
	} else {
		OriginalAppStore.paths.userDataDirsFolder = store.store.paths.userDataDirsFolder;
	}

	// 强制更新路径
	store.set('paths', OriginalAppStore.paths);

	if (!existsSync(store.store.paths.userDataDirsFolder)) {
		mkdirSync(store.store.paths.userDataDirsFolder, { recursive: true });
	}
	if (!existsSync(store.store.paths.extensionsFolder)) {
		mkdirSync(store.store.paths.extensionsFolder, { recursive: true });
	}
	if (!existsSync(store.store.paths.downloadFolder)) {
		mkdirSync(store.store.paths.downloadFolder, { recursive: true });
	}
}

/** 字符串转换成版本对象 */
function parseVersion(version: string) {
	return new SemVer(valid(coerce(clean(version, { loose: true }))) || '0.0.0');
}
