export type PageRectangle = { x: number; y: number; width: number; height: number };

export interface EmbeddedPageImage {
	toPNG(): Buffer;
}

export interface EmbeddedPageHost {
	getURL(): string;
	loadURL(url: string): Promise<void>;
	isLoading(): boolean;
	isDestroyed(): boolean;
	executeJavaScript<T = unknown>(code: string): Promise<T>;
	capturePage(rect?: PageRectangle): Promise<EmbeddedPageImage>;
	insertText(text: string): void;
	on(event: string, listener: () => void): void;
	removeListener(event: string, listener: () => void): void;
	action(property: string, args: unknown[]): Promise<unknown>;
	waitForResponse(matcher: unknown, timeout: number): Promise<unknown>;
	waitForNetworkIdle(timeout: number): Promise<void>;
}

type LoadListener = (page: EmbeddedPage) => void;

/** 把浏览器配置里的 { value } 取成脚本直接使用的值。 */
export function readAutomationConfigValues(configs: Record<string, { value?: unknown }> | undefined) {
	const values: Record<string, unknown> = {};
	for (const key of Object.keys(configs || {})) {
		values[key] = configs?.[key]?.value;
	}
	return values;
}

/**
 * 给现有自动化程序用的页面对象。
 * 这些脚本原来接收 Playwright Page，这里只实现它们实际调用的方法。
 */
export function createEmbeddedPage(host: EmbeddedPageHost) {
	return new EmbeddedPage(host);
}

class EmbeddedPage {
	private readonly loadListeners = new Map<LoadListener, () => void>();
	private mousePosition = { x: 0, y: 0 };
	readonly mouse = {
		move: async (x: number, y: number, options?: { steps?: number }) => {
			const steps = Math.max(1, Math.floor(options?.steps || 1));
			for (let step = 1; step <= steps; step++) {
				const next = {
					x: this.mousePosition.x + ((x - this.mousePosition.x) * step) / steps,
					y: this.mousePosition.y + ((y - this.mousePosition.y) * step) / steps
				};
				await this.host.action('mouse.move', [next.x, next.y]);
				this.mousePosition = next;
			}
		},
		down: async () => {
			await this.host.action('mouse.down', []);
		},
		up: async () => {
			await this.host.action('mouse.up', []);
		}
	};

	constructor(private readonly host: EmbeddedPageHost) {}

	url() {
		return this.host.getURL();
	}

	async goto(url: string) {
		this.assertOpen();
		await this.host.loadURL(url);
	}

	async waitForTimeout(ms: number) {
		await delay(ms);
	}

	async waitForLoadState(state = 'load') {
		this.assertOpen();
		if (state === 'networkidle') {
			await this.host.waitForNetworkIdle(30_000);
			return;
		}
		if (this.host.isLoading()) await this.waitUntilSettled(30_000);
	}

	async waitForNavigation(options?: { timeout?: number }) {
		this.assertOpen();
		await this.waitUntilSettled(options?.timeout ?? 30_000, !this.host.isLoading());
	}

	async waitForSelector(selector: string, options?: { timeout?: number; state?: string }) {
		this.assertOpen();
		await this.host.action('waitForSelector', [selector, options]);
	}

	async waitForResponse(matcher: unknown, options?: { timeout?: number }) {
		this.assertOpen();
		return this.host.waitForResponse(matcher, options?.timeout ?? 30_000);
	}

	async waitForFunction(pageFunction: unknown, arg?: unknown, options?: { timeout?: number }) {
		this.assertOpen();
		const timeout = options?.timeout ?? 30_000;
		const started = Date.now();
		while (Date.now() - started < timeout) {
			if (await this.evaluate(pageFunction, arg)) return;
			await delay(100);
		}
		throw new Error('等待页面条件超时');
	}

	async click(selector: string, options?: { timeout?: number; position?: { x: number; y: number } }) {
		this.assertOpen();
		await this.waitForSelector(selector, { timeout: options?.timeout, state: 'visible' });
		if (!options?.position) {
			await this.host.action('click', [selector, options]);
			return;
		}
		const rect = await this.box(selector);
		const point = { x: rect.x + options.position.x, y: rect.y + options.position.y };
		this.mousePosition = point;
		await this.host.action('mouse.click', [point.x, point.y]);
	}

	async fill(selector: string, value: string) {
		this.assertOpen();
		await this.waitForSelector(selector, { state: 'visible' });
		await this.host.action('fill', [selector, value]);
	}

	async type(selector: string, text: string, options?: { delay?: number }) {
		this.assertOpen();
		await this.waitForSelector(selector, { state: 'visible' });
		await this.host.action('focus', [selector]);
		const pause = options?.delay ?? 0;
		for (const character of Array.from(text)) {
			this.assertOpen();
			this.host.insertText(character);
			if (pause > 0) await delay(pause);
		}
	}

	async $(selector: string) {
		this.assertOpen();
		const exists = await this.host.executeJavaScript<boolean>(
			`Boolean(document.querySelector(${JSON.stringify(selector)}))`
		);
		return exists ? new EmbeddedElement(this.host, selector) : null;
	}

	async evaluate(pageFunction: unknown, arg?: unknown) {
		this.assertOpen();
		return this.host.executeJavaScript(compilePageFunction(pageFunction, arg));
	}

	async screenshot(options?: { clip?: PageRectangle }) {
		this.assertOpen();
		const image = await this.host.capturePage(options?.clip);
		return image.toPNG();
	}

	on(event: string, listener: LoadListener) {
		if (event !== 'load' || this.loadListeners.has(listener)) return;
		const wrapped = () => listener(this);
		this.loadListeners.set(listener, wrapped);
		this.host.on('did-finish-load', wrapped);
	}

	off(event: string, listener: LoadListener) {
		if (event !== 'load') return;
		const wrapped = this.loadListeners.get(listener);
		if (!wrapped) return;
		this.loadListeners.delete(listener);
		this.host.removeListener('did-finish-load', wrapped);
	}

	private async box(selector: string) {
		const rect = await this.host.executeJavaScript<PageRectangle | null>(
			`(() => { const element = document.querySelector(${JSON.stringify(
				selector
			)}); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }; })()`
		);
		if (!rect) throw new Error(`元素不存在：${selector}`);
		return rect;
	}

	private waitUntilSettled(timeout: number, waitForNext = false) {
		this.assertOpen();
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => finish(new Error('等待页面加载超时')), timeout);
			const finish = (error?: Error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				this.host.removeListener('did-finish-load', onFinish);
				this.host.removeListener('did-fail-load', onFinish);
				if (error) reject(error);
				else resolve();
			};
			const onFinish = () => finish();
			this.host.on('did-finish-load', onFinish);
			this.host.on('did-fail-load', onFinish);
			if (!waitForNext && !this.host.isLoading()) finish();
		});
	}

	private assertOpen() {
		if (this.host.isDestroyed()) throw new Error('浏览器页面已关闭。');
	}
}

class EmbeddedElement {
	constructor(private readonly host: EmbeddedPageHost, private readonly selector: string) {}

	async getAttribute(name: string) {
		return this.host.executeJavaScript<string | null>(
			`document.querySelector(${JSON.stringify(this.selector)})?.getAttribute(${JSON.stringify(name)}) ?? null`
		);
	}

	async isVisible() {
		return this.host.executeJavaScript<boolean>(
			`(() => { const element = document.querySelector(${JSON.stringify(
				this.selector
			)}); if (!element) return false; const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; })()`
		);
	}

	async boundingBox() {
		return this.host.executeJavaScript<PageRectangle | null>(
			`(() => { const element = document.querySelector(${JSON.stringify(
				this.selector
			)}); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }; })()`
		);
	}

	async screenshot() {
		const box = await this.boundingBox();
		if (!box || box.width <= 0 || box.height <= 0) return Buffer.alloc(0);
		const image = await this.host.capturePage({
			x: Math.max(0, Math.floor(box.x)),
			y: Math.max(0, Math.floor(box.y)),
			width: Math.max(1, Math.ceil(box.width)),
			height: Math.max(1, Math.ceil(box.height))
		});
		return image.toPNG();
	}

	async fill(value: string) {
		await this.host.action('fill', [this.selector, value]);
	}

	async evaluate(pageFunction: unknown) {
		const source = typeof pageFunction === 'function' ? `(${pageFunction.toString()})` : String(pageFunction);
		return this.host.executeJavaScript(`(${source})(document.querySelector(${JSON.stringify(this.selector)}))`);
	}
}

function compilePageFunction(pageFunction: unknown, arg?: unknown) {
	if (typeof pageFunction === 'string') return pageFunction;
	if (typeof pageFunction === 'function') return `(${pageFunction.toString()})(${JSON.stringify(arg ?? null)})`;
	throw new Error('页面脚本格式不正确');
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
