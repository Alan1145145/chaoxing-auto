import { Project, Script, $ui } from 'easy-us';
import { $msg } from '../utils';
import { createSteps } from '../utils/ui';
import { CommonProject } from './common';
import { createCommonAnswerer } from '../utils/work';

/**
 * 学习强国（xuexi.cn）
 *
 * 2026-11 新增平台。页面结构均为实测（2026-11-07，公开页面无需登录即可访问）：
 * - 门户首页 https://www.xuexi.cn/ ：栏目数据来自同源静态 JSON（/lgdata/index.json 的 DataSet → /lgdata/<token>.json），
 *   条目形如 { title, url, itemId, type: 'tuwen' | 'shipin' | 'juji' | ... , itemType: 'kNews' | 'kReading' | 'kPureVideo' | ... }。
 * - 文章/视频详情 https://www.xuexi.cn/lgpage/detail/index.html?id=<itemId> ：
 *   文章页正文为 h1 + 多个 p 段落；视频页有原生 <video>（blob 源，duration 可读）。
 * - 积分/答题 https://pc.xuexi.cn/points/*.html ：需要「学习强国」App 扫码登录。
 *   每日答题 exam-practice、每周答题 exam-weekly-list/detail、专项答题 exam-paper-list/detail。
 *   答题页 DOM（实测同款）：题干 .q-header（文本以「单选题/多选题/填空题」开头）、
 *   选项 .q-answer（选中加 .chosen）、填空输入 .q-body input、提示按钮 .q-footer .tips
 *   （点击后 .line-feed 内红色文字即官方答案提示）、提交 .submit-btn / 下一题 .next-btn。
 *
 * 兼容策略：
 * - 阅读/视听：页面本身会上报学习行为，脚本只负责模拟人的阅读节奏（停留 + 缓慢滚动）和自动播放，
 *   不伪造任何上报接口。
 * - 答题：优先使用站点自带的「提示」红字答案；没有提示时才走 OCS 题库（内置 AI）兜底，
 *   且仅当用户显式开启「无提示时使用 AI 作答」。滑块验证不代滑，提示人工完成（与 U校园 同一红线）。
 */

const PROJECT_NAME = '学习强国';

/** 完成标记与任务队列都存在 www.xuexi.cn 同源 localStorage，门户与详情页共享。 */
const QUEUE_KEY = 'ocs-xuexi-queue';
const DONE_KEY = 'ocs-xuexi-done-list';

type XuexiItemType = 'tuwen' | 'shipin' | 'juji';

type XuexiQueueItem = {
	id: string;
	url: string;
	title: string;
	type: XuexiItemType;
};

const state = {
	running: false,
	currentVideo: undefined as HTMLVideoElement | undefined
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function isTopFrame() {
	try {
		return window.top === window.self;
	} catch {
		return false;
	}
}

function textOf(element: Element | null | undefined) {
	return (element?.textContent || '').replace(/\s+/g, ' ').trim();
}

function readJsonList<T>(raw: string | null | undefined): T[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function readQueue(): XuexiQueueItem[] {
	return readJsonList<XuexiQueueItem>(localStorage.getItem(QUEUE_KEY));
}

function writeQueue(queue: XuexiQueueItem[]) {
	localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, 200)));
}

function readDone(): string[] {
	return readJsonList<string>(localStorage.getItem(DONE_KEY));
}

function markDone(id: string) {
	if (!id) return;
	const done = readDone();
	if (!done.includes(id)) {
		done.push(id);
		// 只保留最近 500 条，避免无限增长。
		localStorage.setItem(DONE_KEY, JSON.stringify(done.slice(-500)));
	}
}

function isDone(id: string) {
	return readDone().includes(id);
}

/** 门户/详情页都在 www.xuexi.cn 同源，可以直接 fetch 官方静态栏目数据。 */
async function fetchPortalItems(): Promise<XuexiQueueItem[]> {
	const items: XuexiQueueItem[] = [];
	const seen = new Set<string>();
	try {
		const index = await fetch('/lgdata/index.json', { credentials: 'omit' }).then((res) => res.json());
		const tokens: string[] = Array.isArray(index?.DataSet) ? index.DataSet : [];
		// DataSet 顺序即门户栏目顺序，取前 8 个栏目足够一天的学习量。
		for (const entry of tokens.slice(0, 8)) {
			const token = String(entry).split('!').pop() || '';
			if (!token) continue;
			try {
				const list = await fetch(`/lgdata/${token}`, { credentials: 'omit' }).then((res) => res.json());
				if (!Array.isArray(list)) continue;
				for (const item of list) {
					const url = String(item?.url || '');
					const id = String(item?.itemId || '');
					const type = String(item?.type || '');
					if (!url || !id || seen.has(id)) continue;
					if (!/lgpage\/detail\/index\.html\?id=/.test(url)) continue;
					if (type !== 'tuwen' && type !== 'shipin' && type !== 'juji') continue;
					seen.add(id);
					items.push({ id, url, title: String(item?.title || '').trim(), type: type as XuexiItemType });
				}
			} catch {
				// 单个栏目失败不影响整体队列。
			}
		}
	} catch (error) {
		$msg.warn({ content: `${PROJECT_NAME}栏目数据获取失败，将只学习当前页面。` });
	}
	return items;
}

/** 组队列：文章与视频交替，优先未学过的条目。 */
function buildQueue(items: XuexiQueueItem[], articleCount: number, videoCount: number) {
	const done = new Set(readDone());
	const articles = items.filter((item) => item.type === 'tuwen' && !done.has(item.id));
	const videos = items.filter((item) => item.type !== 'tuwen' && !done.has(item.id));
	const queue: XuexiQueueItem[] = [];
	for (let i = 0; i < Math.max(articleCount, videoCount); i++) {
		if (i < articleCount && articles[i]) queue.push(articles[i]);
		if (i < videoCount && videos[i]) queue.push(videos[i]);
	}
	writeQueue(queue);
	return queue;
}

async function gotoNextFromQueue(autoNext: boolean) {
	if (!autoNext) return false;
	const queue = readQueue();
	const next = queue.shift();
	writeQueue(queue);
	if (!next) return false;
	$msg.info({ content: `${PROJECT_NAME}：下一篇「${next.title || next.type}」` });
	await sleep(1500 + randomBetween(0, 800));
	location.href = next.url;
	return true;
}

/** 缓慢滚动，模拟真人阅读。返回是否滚动过内容。 */
async function scrollArticle(totalMs: number) {
	const deadline = Date.now() + totalMs;
	window.scrollTo({ top: 300 + randomBetween(0, 200), behavior: 'smooth' });
	while (Date.now() < deadline && state.running) {
		await sleep(1000 + randomBetween(500, 2500));
		const maxY = document.body.scrollHeight - document.documentElement.clientHeight;
		if (maxY > 0) {
			const forward = randomBetween(0, 4) > 0;
			window.scrollBy({ top: forward ? 120 + randomBetween(0, 200) : -80 - randomBetween(0, 120), behavior: 'smooth' });
		}
	}
}

/** 播放当前视频直到结束（或到达兜底时长）。 */
async function playVideo(video: HTMLVideoElement, rate: number, maxSeconds: number) {
	state.currentVideo = video;
	try {
		video.muted = true;
		if (Number.isFinite(rate) && rate > 0) {
			try {
				video.playbackRate = rate;
			} catch {
				// 部分播放器锁定倍速，忽略即可。
			}
		}
		// play() 的 Promise 在个别播放器上可能永远 pending（无源/自定义播放器），
		// 只等 2 秒，播放状态交给下面的循环照看。
		await Promise.race([
			video.play().then(
				() => undefined,
				() => {
					$msg.warn({ content: '浏览器拦截了自动播放，请点击一次视频播放器，脚本会继续接管。' });
				}
			),
			sleep(2000)
		]);
		const duration = Number.isFinite(video.duration) ? video.duration : 0;
		const deadline = Date.now() + Math.min(maxSeconds, duration > 0 ? duration / rate + 15 : maxSeconds) * 1000;
		while (Date.now() < deadline && state.running) {
			await sleep(1500);
			if (video.ended || (duration > 0 && video.currentTime >= duration - 1.5)) break;
			if (video.paused) await Promise.race([video.play().catch(() => undefined), sleep(1500)]);
		}
	} finally {
		state.currentVideo = undefined;
	}
}

/** 是否出现滑块验证（不代滑，提示人工处理）。 */
function sliderVisible() {
	const mask = document.getElementById('nc_mask');
	if (mask && getComputedStyle(mask).display !== 'none') return true;
	return !!document.getElementById('nc_1_n1z')?.getClientRects().length;
}

async function waitForSliderGone() {
	if (!sliderVisible()) return;
	$msg.warn({ content: '检测到滑块验证，请手动拖动完成，脚本会自动继续。' });
	while (sliderVisible() && state.running) await sleep(1500);
}

// ---------------------------------------------------------------- 答题 -----------------------------------------------

type ExamQuestion = {
	type: 'single' | 'multiple' | 'fill';
	headerText: string;
	questionText: string;
};

function parseExamHeader(): ExamQuestion | null {
	const header = document.querySelector('.q-header');
	if (!header) return null;
	const headerText = textOf(header);
	const body = textOf(document.querySelector('.q-body'));
	let type: ExamQuestion['type'] = 'single';
	if (headerText.startsWith('多选题')) type = 'multiple';
	else if (headerText.startsWith('填空题')) type = 'fill';
	return { type, headerText, questionText: body || headerText };
}

/** 站点自带答案提示：点击 .tips 后 .line-feed 里的红字即官方答案。 */
async function readOfficialHint(): Promise<string[]> {
	const tips = document.querySelector('.q-footer .tips') as HTMLElement | null;
	if (tips) {
		tips.click();
		await sleep(800 + randomBetween(0, 600));
	}
	const red = Array.from(document.querySelectorAll('.line-feed [color="red"], .line-feed [color=red]')).map((el) => textOf(el));
	const fonts = Array.from(document.querySelectorAll('.line-feed > font')).map((el) => textOf(el));
	let hints = red.filter(Boolean);
	if (!hints.length) hints = fonts.filter(Boolean);
	if (!hints.length) {
		hints = Array.from(document.querySelectorAll('.line-feed'))
			.map((el) => textOf(el))
			.filter((text) => text && text !== '请观看视频');
	}
	return hints;
}

function normalizeOptionText(text: string) {
	return text
		.replace(/^\s*[0-9A-Ha-hＡ-Ｈ][.．、:：)）]\s*/, '')
		.replace(/[（(]/g, '（')
		.replace(/[）)]/g, '）')
		.replace(/\s+/g, '')
		.trim();
}

function selectOptions(hints: string[]): number {
	const answers = hints.join('');
	if (!answers) return 0;
	let chosen = 0;
	const options = Array.from(document.querySelectorAll('.q-answer')) as HTMLElement[];
	const scored: { element: HTMLElement; score: number }[] = [];
	for (const option of options) {
		const optionText = normalizeOptionText(textOf(option));
		if (!optionText) continue;
		const isChosen = String(option.className).includes('chosen');
		const exact =
			(optionText.includes(answers) || answers.includes(optionText)) && answers.length > 0;
		if (exact && !(typeIsSingle() && answers.length !== optionText.length)) {
			if (!isChosen) option.click();
			chosen++;
			continue;
		}
		// 模糊匹配：按字符重合度兜底。
		let score = 0;
		for (const char of new Set(answers)) {
			if (optionText.includes(char)) score++;
		}
		if (!isChosen) scored.push({ element: option, score });
	}
	if (chosen === 0 && scored.length) {
		scored.sort((a, b) => b.score - a.score);
		const best = scored[0];
		if (best.score > 0) {
			best.element.click();
			chosen++;
		}
	}
	return chosen;
}

function typeIsSingle() {
	const header = document.querySelector('.q-header');
	return textOf(header).startsWith('单选题');
}

async function fillBlanks(hints: string[]): Promise<number> {
	const inputs = Array.from(document.querySelectorAll('.q-body input')) as HTMLInputElement[];
	const empty = inputs.filter((input) => !input.value);
	if (!empty.length) return inputs.length;
	let values: string[] = [];
	if (hints.length > 1) values = hints;
	else if (hints.length === 1) {
		// 多空时官方提示常用空格/分隔符连接，先按分隔符切，切不开就整串填第一空。
		const parts = hints[0]
			.split(/[；;，,\s]+/)
			.map((part) => part.trim())
			.filter(Boolean);
		values = parts.length > 1 ? parts : [hints[0]];
	}
	let filled = 0;
	for (const input of empty) {
		const value = values[filled] || values[0] || '';
		if (!value) break;
		input.setAttribute('value', value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
		filled++;
	}
	return filled;
}

/** OCS 题库（内置 AI）兜底：仅在官方提示缺失时调用。 */
async function askQuestionBank(question: ExamQuestion, options: string[]): Promise<string[]> {
	try {
		const wrappers: any[] = (CommonProject as any)?.scripts?.settings?.cfg?.answererWrappers || [];
		if (!wrappers.length) return [];
		const search = createCommonAnswerer({
			titleTransform: () => question.questionText,
			optionsTransform: () => options.join('\n'),
			answererWrappers: wrappers,
			period: 0
		});
		const infos = await search(
			{},
			{ type: question.type === 'fill' ? 'completion' : question.type === 'multiple' ? 'multiple' : 'single', elements: { options: [] } } as any
		);
		const answers: string[] = [];
		for (const info of infos || []) {
			for (const result of info?.results || []) {
				if (result?.answer) answers.push(String(result.answer));
			}
		}
		return answers;
	} catch (error) {
		$msg.warn({ content: `${PROJECT_NAME}题库查询失败：${error instanceof Error ? error.message : String(error)}` });
		return [];
	}
}

function examFinished() {
	return !!document.querySelector('.ant-btn.action.ant-btn-primary') && !document.querySelector('.q-header');
}

/**
 * 答题主循环。
 * 每日/每周/专项答题的提交按钮与题目结构一致（实测同款 DOM），共用一个循环。
 */
async function runExamLoop(
	cfg: {
		useAIWhenNoHint: boolean;
		stepDelayMs: number;
	},
	runningFlag: () => boolean
) {
	let answered = 0;
	let idleChecks = 0;
	while (runningFlag()) {
		await sleep(cfg.stepDelayMs + randomBetween(300, 1200));
		await waitForSliderGone();
		if (examFinished()) {
			$msg.success({ content: `${PROJECT_NAME}：本组答题完成，共作答 ${answered} 题。` });
			return;
		}
		const question = parseExamHeader();
		if (!question) {
			// 页面长时间既没有题目也没有「完成」状态，视为异常，停止循环防止空转。
			idleChecks++;
			if (idleChecks > 60) {
				$msg.warn({ content: `${PROJECT_NAME}：长时间未检测到题目，自动答题已暂停，请刷新或手动检查。` });
				return;
			}
			continue;
		}
		idleChecks = 0;
		let hints = await readOfficialHint();
		if (!hints.length && cfg.useAIWhenNoHint) {
			const options = Array.from(document.querySelectorAll('.q-answer')).map((el) => textOf(el as HTMLElement));
			const aiAnswers = await askQuestionBank(question, options);
			if (aiAnswers.length) hints = aiAnswers;
			else $msg.warn({ content: `${PROJECT_NAME}：本题没有官方提示，题库也未命中，请手动作答本题。` });
		}
		let done = 0;
		if (question.type === 'fill') done = await fillBlanks(hints);
		else done = selectOptions(hints);
		if (done > 0) answered++;
		await sleep(randomBetween(800, 1800));
		const submit = document.querySelector('.submit-btn') as HTMLElement | null;
		if (submit) submit.click();
		else {
			const next = document.querySelector('.next-btn') as HTMLElement | null;
			if (next) next.click();
		}
	}
}

// ---------------------------------------------------------------- 项目 -----------------------------------------------

export const XuexiProject = Project.create({
	name: PROJECT_NAME,
	domains: ['xuexi.cn'],
	scripts: {
		guide: new Script({
			name: '💡 使用提示',
			matches: [
				['学习强国门户', 'www.xuexi.cn'],
				['学习强国积分页', 'pc.xuexi.cn/points'],
				['学习强国详情页', 'www.xuexi.cn/lgpage']
			],
			namespace: 'xuexi.guide-v1',
			configs: {
				notes: {
					defaultValue: createSteps([
						'阅读/视听：打开门户或任意文章、视频详情页，脚本自动学习并接续下一篇。',
						'积分/答题：需要先用「学习强国」App 扫码登录 pc.xuexi.cn。',
						'答题：进入每日/每周/专项答题页后自动作答，优先使用官方「提示」答案。',
						'滑块验证不代滑：出现时请手动完成，脚本会自动继续。'
					]).outerHTML
				}
			}
		}),
		home: new Script({
			name: '🚀 门户调度',
			// matches 按 RegExp 对完整 URL 测试，必须锚定到门户首页本身，
			// 否则会连 www.xuexi.cn/lgpage/detail/... 一起命中，在详情页反复重建队列。
			matches: [['学习强国门户首页', 'www\\.xuexi\\.cn/(index\\.html)?([?#]|$)']],
			namespace: 'xuexi.home-v1',
			configs: {
				notes: {
					defaultValue: $ui
						.notes(['门户首页会自动整理学习队列；携带 autostart=1 参数进入时直接开始第一篇。'])
						.outerHTML
				},
				articleCount: {
					label: '阅读文章数',
					attrs: { type: 'number', min: '1', max: '30', step: '1' },
					defaultValue: 6
				},
				videoCount: {
					label: '观看视频数',
					attrs: { type: 'number', min: '1', max: '30', step: '1' },
					defaultValue: 6
				},
				autoStart: {
					label: '打开门户后自动开始学习',
					attrs: { type: 'checkbox' },
					defaultValue: false
				}
			},
			async oncomplete() {
				if (!isTopFrame()) return;
				// 队列由门户首页统一整理；详情页只消费。
				const url = new URL(location.href);
				const wantsStart = url.searchParams.has('autostart') || this.cfg.autoStart === true;
				const items = await fetchPortalItems();
				if (!items.length) {
					$msg.warn({ content: `${PROJECT_NAME}：未获取到栏目数据，无法整理学习队列。` });
					return;
				}
				const queue = buildQueue(items, Number(this.cfg.articleCount) || 6, Number(this.cfg.videoCount) || 6);
				$msg.info({ content: `${PROJECT_NAME}：队列已就绪（${queue.length} 项）。` });
				if (wantsStart && queue.length) {
					// 弹出第一篇再进入：否则第一篇会在完成后被 gotoNext 再学一遍。
					const remaining = readQueue();
					const first = remaining.shift();
					writeQueue(remaining);
					await sleep(1200);
					if (first) location.href = first.url;
				}
			}
		}),
		study: new Script({
			name: '📚 阅读与视听',
			matches: [['文章/视频详情页', 'lgpage/detail/index.html']],
			namespace: 'xuexi.study-v1',
			configs: {
				notes: {
					defaultValue: $ui
						.notes([
							'文章：缓慢滚动并停留设定时间；视频：静音自动播放到结束。',
							'完成后自动接续队列里的下一篇；队列见门户页说明。'
						])
						.outerHTML
				},
				articleSeconds: {
					label: '每篇文章学习时长（秒）',
					attrs: { type: 'number', min: '15', max: '300', step: '1' },
					defaultValue: 75
				},
				videoRate: {
					label: '视频倍速',
					tag: 'select',
					defaultValue: '1',
					options: [
						['1', '1.0 x'],
						['1.25', '1.25 x'],
						['1.5', '1.5 x'],
						['2', '2.0 x']
					]
				},
				maxVideoSeconds: {
					label: '单个视频最长等待（秒）',
					attrs: { type: 'number', min: '30', max: '3600', step: '10' },
					defaultValue: 1200
				},
				autoNext: {
					label: '完成后自动下一篇',
					attrs: { type: 'checkbox' },
					defaultValue: true
				}
			},
			async oncomplete() {
				if (!isTopFrame()) return;
				state.running = true;
				const itemId = new URLSearchParams(location.search).get('id') || '';
				const video = document.querySelector('video') as HTMLVideoElement | null;
				try {
					if (video) {
						$msg.info({ content: `${PROJECT_NAME}：视频学习中...` });
						await playVideo(video, Number(this.cfg.videoRate) || 1, Number(this.cfg.maxVideoSeconds) || 1200);
					} else {
						const seconds = Number(this.cfg.articleSeconds) || 75;
						$msg.info({ content: `${PROJECT_NAME}：阅读学习中（${seconds} 秒）...` });
						await scrollArticle(seconds * 1000);
					}
					markDone(itemId);
					$msg.success({ content: `${PROJECT_NAME}：本篇学习完成。` });
					const next = await gotoNextFromQueue(this.cfg.autoNext !== false);
					if (!next) {
						$msg.success({ content: `${PROJECT_NAME}：队列已全部完成，可回门户重新整理队列。` });
					}
				} finally {
					state.running = false;
				}
			}
		}),
		points: new Script({
			name: '🎯 积分页',
			matches: [
				['我的积分页', 'pc.xuexi.cn/points/my-points.html'],
				['扫码登录页', 'pc.xuexi.cn/points/login.html']
			],
			namespace: 'xuexi.points-v1',
			configs: {
				notes: {
					defaultValue: $ui
						.notes(['积分与答题都需要登录：出现二维码时，用「学习强国」App 扫码即可。'])
						.outerHTML
				}
			},
			oncomplete() {
				if (!isTopFrame()) return;
				setTimeout(() => {
					const qrcode = document.querySelector('.qrcode-box, [class*="qrcode"]');
					if (qrcode && (qrcode as HTMLElement).offsetParent !== null) {
						$msg.info({ content: `${PROJECT_NAME}：请用「学习强国」App 扫码登录。` });
					} else if (location.pathname.includes('my-points')) {
						$msg.success({ content: `${PROJECT_NAME}：已登录，可打开答题页面开始自动作答。` });
					}
				}, 3000);
			}
		}),
		exam: new Script({
			name: '✍️ 自动答题',
			matches: [
				['每日答题', 'pc.xuexi.cn/points/exam-practice.html'],
				['每周答题', 'pc.xuexi.cn/points/exam-weekly-detail.html'],
				['专项答题', 'pc.xuexi.cn/points/exam-paper-detail.html']
			],
			namespace: 'xuexi.exam-v1',
			configs: {
				notes: {
					defaultValue: $ui
						.notes([
							'优先使用页面自带「提示」红字答案；没有提示时按设置决定是否用 OCS 题库（AI）兜底。',
							'每题之间保留随机间隔；滑块验证需要人工完成。'
						])
						.outerHTML
				},
				useAIWhenNoHint: {
					label: '无提示时用 OCS 题库（AI）作答',
					attrs: { type: 'checkbox', title: '关闭后遇到没有官方提示的题目会暂停等待人工作答。' },
					defaultValue: true
				},
				stepDelayMs: {
					label: '答题间隔（毫秒）',
					attrs: { type: 'number', min: '800', max: '20000', step: '100' },
					defaultValue: 2200
				}
			},
			oncomplete() {
				if (!isTopFrame()) return;
				const cfg = {
					useAIWhenNoHint: this.cfg.useAIWhenNoHint !== false,
					stepDelayMs: Number(this.cfg.stepDelayMs) || 2200
				};
				setTimeout(async () => {
					if (document.querySelector('.qrcode-box, [class*="qrcode"]')) {
						$msg.warn({ content: `${PROJECT_NAME}：答题前请先扫码登录。` });
						return;
					}
					state.running = true;
					try {
						await runExamLoop(cfg, () => state.running);
					} finally {
						state.running = false;
					}
				}, 3000);
			},
			onhistorychange() {
				// SPA 内切换题目不会触发完整加载，保持循环由 oncomplete 常驻即可。
			}
		}),
		weeklyList: new Script({
			name: '🗓️ 每周答题列表',
			matches: [['每周答题列表', 'pc.xuexi.cn/points/exam-weekly-list.html']],
			namespace: 'xuexi.weekly-list-v1',
			configs: {
				autoEnter: {
					label: '自动进入本年度未完成的答题',
					attrs: { type: 'checkbox' },
					defaultValue: true
				}
			},
			oncomplete() {
				if (!isTopFrame() || this.cfg.autoEnter === false) return;
				setTimeout(() => {
					const year = String(new Date().getFullYear());
					const buttons = Array.from(document.querySelectorAll('.week > button')) as HTMLElement[];
					const target = buttons.find((button) => {
						const text = textOf(button);
						const itemYear = textOf(button.parentElement?.firstElementChild).slice(0, 4);
						return (text === '开始答题' || text === '继续答题') && itemYear === year;
					});
					if (target) {
						$msg.info({ content: `${PROJECT_NAME}：进入本年度每周答题。` });
						target.click();
					} else {
						$msg.success({ content: `${PROJECT_NAME}：本年度每周答题已完成或未开放。` });
					}
				}, 3000);
			}
		}),
		paperList: new Script({
			name: '📄 专项答题列表',
			matches: [['专项答题列表', 'pc.xuexi.cn/points/exam-paper-list.html']],
			namespace: 'xuexi.paper-list-v1',
			configs: {
				autoEnter: {
					label: '自动进入最新的未完成答题',
					attrs: { type: 'checkbox' },
					defaultValue: true
				}
			},
			oncomplete() {
				if (!isTopFrame() || this.cfg.autoEnter === false) return;
				setTimeout(() => {
					const year = String(new Date().getFullYear());
					const buttons = Array.from(document.querySelectorAll('.item .right > button')) as HTMLElement[];
					const target = buttons.find((button) => {
						const text = textOf(button);
						const row = button.closest('.item');
						const itemYear = textOf(row?.querySelector('.item-info, .left, [class*="time"]')).slice(0, 4);
						return (text === '开始答题' || text === '继续答题') && (!itemYear || itemYear === year);
					});
					if (target) {
						$msg.info({ content: `${PROJECT_NAME}：进入专项答题。` });
						target.click();
					} else {
						$msg.success({ content: `${PROJECT_NAME}：专项答题没有待完成项目。` });
					}
				}, 3000);
			}
		})
	}
});
