import { XUEXI_PLATFORM } from '@ocs-desktop/common';
import { AutomationScript } from '../../script';

/**
 * 学习强国（xuexi.cn）打开入口。
 *
 * 学习强国没有账号密码登录：网页端只能用「学习强国」App 扫码，所以这里的自动化
 * 只负责打开正确的页面并让 OCS 接管：
 * - 自动学习：打开门户首页并携带 autostart=1，OCS 会整理阅读/视听队列并开始第一篇；
 * - 积分/答题：打开积分页（未登录时页面会显示二维码，扫码后即可使用自动答题）。
 *
 * 页面结构依据（2026-11-07 实测）：
 * - 门户 https://www.xuexi.cn/ ，栏目数据 /lgdata/index.json → /lgdata/<token>.json；
 * - 详情 https://www.xuexi.cn/lgpage/detail/index.html?id=<itemId>；
 * - 积分 https://pc.xuexi.cn/points/my-points.html；
 * - 每日答题 https://pc.xuexi.cn/points/exam-practice.html（还有 exam-weekly-list / exam-paper-list）。
 */

export const XUEXI_HOME_URL = 'https://www.xuexi.cn/';
export const XUEXI_POINTS_URL = 'https://pc.xuexi.cn/points/my-points.html';
export const XUEXI_EXAM_URL = 'https://pc.xuexi.cn/points/exam-practice.html';
export const XUEXI_LOGIN_URL = 'https://pc.xuexi.cn/points/login.html';

type XuexiPage = {
	url(): string;
	goto(url: string): Promise<unknown>;
	waitForTimeout(ms: number): Promise<unknown>;
	evaluate<T = unknown>(pageFunction: (arg: any) => unknown, arg?: unknown): Promise<T>;
};

function emit(message: string) {
	XuexiOpenScript.emit('script-data', message);
}

function fail(message: string) {
	XuexiOpenScript.emit('script-error', message);
}

/** 打开页面并等待文档就绪，导航竞态统一在这里吞掉（与 U校园 同一处理）。 */
async function gotoSteadily(page: XuexiPage, url: string, waitMs = 6000) {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await page.goto(url);
			await page.waitForTimeout(waitMs);
			emit(`已打开 ${url}`);
			return;
		} catch (error) {
			const message = String(error);
			if (
				/Execution context was destroyed|Cannot find context|Navigating frame was detached|Target page/i.test(
					message
				)
			) {
				await page.waitForTimeout(1500);
				continue;
			}
			throw error;
		}
	}
	fail(`打开 ${url} 失败，请检查网络后重试。`);
}

export const XuexiOpenScript = new AutomationScript(
	{
		url: {
			label: '学习强国页面地址',
			value: XUEXI_HOME_URL,
			type: 'text',
			required: true,
			placeholder: '默认打开门户并自动开始学习，也可以粘贴积分页或答题页地址'
		},
		autoStart: {
			label: '自动开始阅读/视听学习',
			value: true,
			type: 'switch'
		}
	},
	{
		name: '学习强国-打开学习',
		icon: 'https://www.xuexi.cn/favicon.ico',
		async run(page, configs) {
			const target = String(configs.url || '').trim() || XUEXI_PLATFORM.url;
			try {
				const url = new URL(target);
				const isHome = /(^|\.)xuexi\.cn$/i.test(url.hostname) && (url.pathname === '/' || url.pathname === '/index.html');
				if (isHome && configs.autoStart !== false) {
					url.searchParams.set('autostart', '1');
				}
				await gotoSteadily(page as unknown as XuexiPage, url.toString());
				// 登录态提示：未登录时积分/答题页面会显示二维码，提示用户扫码而不是报错。
				if (/pc\.xuexi\.cn\/points/i.test(url.toString())) {
					await page.waitForTimeout(2500);
					const needLogin = await page
						.evaluate(() => {
							const box = document.querySelector('.qrcode-box, [class*="qrcode"]');
							return Boolean(box && (box as HTMLElement).offsetParent !== null);
						})
						.catch(() => false);
					if (needLogin) {
						emit('检测到扫码登录页：请用「学习强国」App 扫码，登录后脚本会继续工作。');
					}
				}
			} catch (error) {
				fail(`学习强国打开失败：${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
);
