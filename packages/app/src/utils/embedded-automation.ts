import { WebContents } from 'electron';
import { Logger } from '../logger';
import { AutomationScripts } from '../scripts';
import { store } from '../store';
import {
	executeEmbeddedBrowserAction,
	requireEmbeddedWebContents,
	waitForEmbeddedNetworkIdle,
	waitForEmbeddedResponse
} from './embedded-browser';
import { createEmbeddedPage, EmbeddedPageHost, readAutomationConfigValues } from './embedded-page';

const logger = Logger('automation');
let automationQueue: Promise<unknown> = Promise.resolve();

export type EmbeddedAutomationRequest = {
	name: string;
	configs?: Record<string, { value?: unknown }>;
};

export type EmbeddedAutomationResult = {
	name: string;
	ok: boolean;
	error?: string;
};

/** 在已经打开的内嵌浏览器里按顺序执行该浏览器配置的自动化程序。 */
export function runEmbeddedAutomationScripts(uid: string, scripts: EmbeddedAutomationRequest[]) {
	// 自动化程序对象是进程内单例，错误事件不能让两个浏览器同时监听。
	const current = automationQueue.catch(() => undefined).then(() => runEmbeddedAutomationScriptsNow(uid, scripts));
	automationQueue = current;
	return current;
}

async function runEmbeddedAutomationScriptsNow(
	uid: string,
	scripts: EmbeddedAutomationRequest[]
): Promise<EmbeddedAutomationResult[]> {
	const pending = (Array.isArray(scripts) ? scripts : []).filter((script) => script?.name);
	if (!pending.length) return [];

	const contents = requireEmbeddedWebContents(uid);
	const page = createEmbeddedPage(createHost(contents));
	const results: EmbeddedAutomationResult[] = [];

	for (const requested of pending) {
		const script = AutomationScripts.find((item) => item.name === requested.name);
		if (!script) {
			const error = `未找到自动化程序：${requested.name}`;
			logger.error(error);
			results.push({ name: requested.name, ok: false, error });
			continue;
		}

		const errors: string[] = [];
		const onError = (...messages: string[]) => {
			errors.push(messages.map((message) => String(message)).join(' '));
		};
		logger.info(`开始执行自动化程序：${script.name}`);
		script.on('script-error', onError);
		try {
			await script.run(page as any, readAutomationConfigValues(requested.configs) as any, {
				ocrApiUrl: `http://localhost:${store.store.server.port || 15319}/ocr`,
				ocrApiImageKey: 'image',
				detBackgroundKey: 'det_bg',
				detTargetKey: 'det_target'
			});
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		} finally {
			script.off('script-error', onError);
		}

		const error = Array.from(new Set(errors.filter(Boolean))).join('\n');
		if (error) {
			logger.error(`自动化程序未完成：${script.name} ${error}`);
			results.push({ name: script.name, ok: false, error });
		} else {
			logger.info(`自动化程序已执行：${script.name}`);
			results.push({ name: script.name, ok: true });
		}
	}

	return results;
}

function createHost(contents: WebContents): EmbeddedPageHost {
	return {
		getURL: () => contents.getURL(),
		loadURL: (url) => contents.loadURL(url),
		isLoading: () => contents.isLoading(),
		isDestroyed: () => contents.isDestroyed(),
		executeJavaScript: (code) => contents.executeJavaScript(code),
		capturePage: async (rect) => contents.capturePage(rect),
		insertText: (text) => contents.insertText(text),
		on: (event, listener) => contents.on(event as any, listener),
		removeListener: (event, listener) => contents.removeListener(event as any, listener),
		action: (property, args) => executeEmbeddedBrowserAction(contents, property, args),
		waitForResponse: (matcher, timeout) => waitForEmbeddedResponse(contents, matcher, timeout),
		waitForNetworkIdle: (timeout) => waitForEmbeddedNetworkIdle(contents, timeout)
	};
}
