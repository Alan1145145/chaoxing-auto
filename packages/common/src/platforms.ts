/**
 * 应用层平台目录。
 *
 * 学习导航和应用内自动化程序共用这里的平台信息。
 * OCSJS 用户脚本是独立发布包，仍由 packages/ocsjs 内的 Project 注册表管理。
 */
export interface PlatformLink {
	id: string;
	name: string;
	url: string;
	courseUrl?: string;
	description?: string;
	icon?: string;
	group: string;
}

export interface PlatformBookmark {
	name: string;
	url: string;
	description?: string;
	icon?: string;
}

export interface PlatformBookmarkGroup {
	group: string;
	values: PlatformBookmark[];
}

export const XUEXI_PLATFORM: PlatformLink = {
	id: 'xuexi',
	name: '学习强国',
	// 网页端没有账号密码登录，统一从门户进入；积分/答题页需要「学习强国」App 扫码。
	url: 'https://www.xuexi.cn/',
	courseUrl: 'https://www.xuexi.cn/',
	description:
		'学习强国：门户自动阅读/视听学习；积分与每日、每周、专项答题需要用「学习强国」App 扫码登录后自动作答。',
	icon: 'https://www.xuexi.cn/favicon.ico',
	group: '网课网站'
};

/** 本项目额外维护、需要合并进远程学习导航的平台。 */
export const LOCAL_PLATFORM_LINKS: PlatformLink[] = [XUEXI_PLATFORM];

function normalizeUrl(url: string) {
	try {
		const parsed = new URL(url);
		return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
	} catch {
		return url.trim().toLowerCase();
	}
}

/**
 * 把本地平台合并到远程书签中。
 * 已存在相同 URL 或同名平台时只保留远程项，避免重复。
 */
export function mergeLocalPlatformBookmarks(remote?: PlatformBookmarkGroup[]): PlatformBookmarkGroup[] {
	const groups = (remote || []).map((group) => ({
		group: group.group,
		values: (group.values || []).filter(Boolean).map((value) => ({ ...value }))
	}));

	for (const platform of LOCAL_PLATFORM_LINKS) {
		const groupName = platform.group || '网课网站';
		let group = groups.find((item) => item.group === groupName);
		if (!group) {
			group = { group: groupName, values: [] };
			groups.push(group);
		}

		const normalized = normalizeUrl(platform.url);
		const exists = groups.some((item) =>
			item.values.some((value) => normalizeUrl(value.url) === normalized || value.name === platform.name)
		);
		if (!exists) {
			group.values.push({
				name: platform.name,
				url: platform.url,
				description: platform.description,
				icon: platform.icon
			});
		}
	}

	return groups;
}
