import assert from 'assert';
import { NewPageScript } from '../scripts/automation/common';
import { createEmbeddedPage, readAutomationConfigValues, EmbeddedPageHost } from './embedded-page';

const values = readAutomationConfigValues({
	phone: { value: '13800000000' },
	password: { value: 'secret' }
});
assert.deepStrictEqual(values, { phone: '13800000000', password: 'secret' });

async function main() {
	const host = createFakeHost();
	const page = createEmbeddedPage(host);

	await page.goto('https://example.com/login');
	assert.deepStrictEqual(host.urls, ['https://example.com/login']);
	assert.strictEqual(page.url(), 'https://example.com/login');

	host.selectors.add('#login');
	await page.click('#login');
	assert.deepStrictEqual(host.actions.at(-1), ['click', ['#login', undefined]]);

	host.boxes.set('#offset', { x: 20, y: 30, width: 100, height: 40 });
	await page.click('#offset', { position: { x: 10, y: 10 } });
	assert.deepStrictEqual(host.actions.at(-1), ['mouse.click', [30, 40]]);

	assert.strictEqual(await page.$('#missing'), null);
	const element = await page.$('#login');
	assert.ok(element);
	assert.strictEqual(await element.getAttribute('src'), 'captcha.png');
	assert.strictEqual(await element.evaluate((node: { id: string }) => node.id), 'login');

	assert.strictEqual(await page.evaluate('1+1'), 2);
	assert.strictEqual(await page.evaluate((value: { name: string } | null) => value?.name, { name: 'ocs' }), 'ocs');

	await page.type('#login', 'ab', { delay: 0 });
	assert.deepStrictEqual(host.typed, ['a', 'b']);

	const beforeMove = host.actions.length;
	await page.mouse.move(10, 0, { steps: 2 });
	assert.deepStrictEqual(host.actions.slice(beforeMove), [
		['mouse.move', [20, 20]],
		['mouse.move', [10, 0]]
	]);

	let loaded = false;
	const onLoad = () => {
		loaded = true;
	};
	page.on('load', onLoad);
	host.emit('did-finish-load');
	assert.strictEqual(loaded, true);
	page.off('load', onLoad);
	host.emit('did-finish-load');
	assert.strictEqual(loaded, true);

	const image = await page.screenshot({ clip: { x: 1, y: 2, width: 3, height: 4 } });
	assert.strictEqual(image.toString('utf8'), 'clip:1,2,3,4');

	host.urls = [];
	await NewPageScript.run(page as any, { url: 'https://example.com/course' });
	assert.deepStrictEqual(host.urls, ['https://example.com/course']);

	await assert.rejects(() => NewPageScript.run(page as any, { url: 'example.com' }), /网页链接格式不正确/);

	console.log('embedded-page spec passed');
}

function readSelector(code: string) {
	const marker = 'document.querySelector(';
	const start = code.indexOf(marker);
	if (start < 0) return undefined;
	const json = code.slice(start + marker.length).match(/^("(?:\\.|[^"\\])*")/)?.[1];
	return json ? (JSON.parse(json) as string) : undefined;
}

function createFakeHost() {
	const listeners = new Map<string, Set<() => void>>();
	const host = {
		urls: [] as string[],
		actions: [] as [string, unknown[]][],
		typed: [] as string[],
		selectors: new Set<string>(),
		boxes: new Map<string, { x: number; y: number; width: number; height: number }>(),
		currentUrl: 'about:blank',
		loading: false,
		getURL() {
			return this.currentUrl;
		},
		async loadURL(url: string) {
			this.urls.push(url);
			this.currentUrl = url;
		},
		isLoading() {
			return this.loading;
		},
		isDestroyed() {
			return false;
		},
		async executeJavaScript<T>(code: string): Promise<T> {
			const selector = readSelector(code);
			if (code.startsWith('Boolean(document.querySelector(')) {
				return this.selectors.has(selector || '') as T;
			}
			if (code.includes('getAttribute')) return 'captcha.png' as T;
			if (code.includes('getBoundingClientRect')) {
				return (selector ? this.boxes.get(selector) || { x: 0, y: 0, width: 10, height: 10 } : null) as T;
			}
			if (code.includes(')(document.querySelector(')) return 'login' as T;
			return (0, eval)(code) as T;
		},
		async capturePage(rect?: { x: number; y: number; width: number; height: number }) {
			const text = rect ? `clip:${rect.x},${rect.y},${rect.width},${rect.height}` : 'page';
			return { toPNG: () => Buffer.from(text) };
		},
		insertText(text: string) {
			this.typed.push(text);
		},
		on(event: string, listener: () => void) {
			const group = listeners.get(event) || new Set<() => void>();
			group.add(listener);
			listeners.set(event, group);
		},
		removeListener(event: string, listener: () => void) {
			listeners.get(event)?.delete(listener);
		},
		async action(property: string, args: unknown[]) {
			this.actions.push([property, args]);
		},
		async waitForResponse() {
			return { url: 'https://example.com' };
		},
		async waitForNetworkIdle() {
			return undefined;
		},
		emit(event: string) {
			for (const listener of listeners.get(event) || []) listener();
		}
	};
	return host as EmbeddedPageHost & typeof host;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
