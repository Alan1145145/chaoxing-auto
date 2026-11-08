/**
 * 学习强国 OCS 兼容夹具。
 *
 * 做法：本地 HTTP 服务 mock 学习强国四个关键页面（门户 / lgdata 数据 / 文章·视频详情 / 每日答题 / 积分页），
 * 用 Playwright host-resolver-rules 把 www.xuexi.cn / pc.xuexi.cn 指到本地，
 * 再通过 addInitScript 在每次导航前注入「真实构建产物」ocs.user.js（GM_* 用 localStorage 桥接），
 * 端到端验证：
 *   1) 门户 autostart：整理队列并跳到第一篇；
 *   2) 文章：停留后标记完成并自动接续队列；
 *   3) 视频：静音接管播放、结束后继续；
 *   4) 队列全部消费完毕；
 *   5) 每日答题：官方提示红字 → 自动选择/填空 → 提交 → 三题后完成；
 *   6) 积分页：扫码提示路径不报错。
 *
 * 运行：node docs/fixtures/xuexi-ocs.mjs
 * 前置：pnpm build:ocsjs（生成 packages/web/public/ocsjs/ocs.user.js）
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, '../..');
const appRequire = createRequire(path.resolve(desktopRoot, 'packages/app/index.js'));
const pw = appRequire('playwright-core');

const ocsSource = fs.readFileSync(
	path.join(desktopRoot, 'packages/web/public/ocsjs/ocs.user.js'),
	'utf8'
);

const chromePath = path.join(
	process.env.LOCALAPPDATA || '',
	'ms-playwright/chromium-1234/chrome-win64/chrome.exe'
);

// ---------------------------------------------------------------- mock 页面 --------------------------------------------

const QUEUE_KEY = 'ocs-xuexi-queue';
const DONE_KEY = 'ocs-xuexi-done-list';

const ARTICLES = [
	{ id: 'A1001', title: '测试文章一', url: '/lgpage/detail/index.html?id=A1001' },
	{ id: 'A1002', title: '测试文章二', url: '/lgpage/detail/index.html?id=A1002' }
];
const VIDEOS = [
	{ id: 'V2001', title: '测试视频一', url: '/lgpage/detail/index.html?id=V2001' },
	{ id: 'V2002', title: '测试视频二', url: '/lgpage/detail/index.html?id=V2002' }
];

const PAGE_SHELL = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

const HOME_HTML = PAGE_SHELL(
	'学习强国',
	'<div class="text-link-item-title">测试头条</div>'
);

function articleHtml(id) {
	const paragraphs = Array.from({ length: 30 })
		.map((_, index) => `<p class="text_align-justify">第${index + 1}段：这是学习强国夹具的测试段落内容，用于验证阅读驻留与滚动。</p>`)
		.join('');
	return PAGE_SHELL(
		'学习强国',
		`<h1>${ARTICLES.find((article) => article.id === id)?.title || '测试文章'}</h1><div class="detail-body">${paragraphs}</div>`
	);
}

const VIDEO_HTML = PAGE_SHELL(
	'学习强国',
	`<h1>测试视频</h1><div class="gr-video-player"><video id="player"></video></div>
<script>
	window.__videoStarted = false;
	setTimeout(function () {
		var v = document.getElementById('player');
		// ended 是原型只读访问器，赋值无效；用实例属性遮蔽后脚本才能读到。
		try { Object.defineProperty(v, 'ended', { value: true, configurable: true }); } catch (e) {}
		v.dispatchEvent(new Event('ended'));
	}, 1500);
</script>`
);

/** 每日答题 mock：单选 → 多选 → 填空，随后进入完成态。 */
const EXAM_HTML = PAGE_SHELL(
	'学习强国',
	`<div class="header-row"></div>
<div class="q-body"></div>
<div class="q-header"></div>
<div class="q-answers"></div>
<div class="q-footer"><button class="tips">提示</button><button class="submit-btn">提交</button></div>
<div class="line-feed" style="display:none"></div>
<button class="ant-btn action ant-btn-primary" style="display:none">查看解析</button>
<script>
	window.__examLog = [];
	var QUESTIONS = [
		{
			type: '单选题 1/3',
			stem: '甲午海战期间，由60余座炮台和要塞构成的（）防御体系堪称“东方的直布罗陀”。',
			options: ['旅顺口', '威海卫', '大连湾'],
			hint: '旅顺口'
		},
		{
			type: '多选题 2/3',
			stem: '下列属于中国四大发明的有（）。',
			options: ['指南针', '造纸术', '地动仪'],
			hint: ['指南针', '造纸术']
		},
		{
			type: '填空题 3/3',
			stem: '“路漫漫其修远兮，吾将______”。',
			fillCount: 1,
			hint: '上下而求索'
		}
	];
	var step = -1;
	function renderNext() {
		step++;
		if (step >= QUESTIONS.length) {
			document.querySelector('.q-header').textContent = '';
			document.querySelector('.q-header').style.display = 'none';
			document.querySelector('.ant-btn.action.ant-btn-primary').style.display = '';
			return;
		}
		var q = QUESTIONS[step];
		document.querySelector('.q-header').style.display = '';
		document.querySelector('.q-header').textContent = q.type;
		document.querySelector('.q-body').innerHTML =
			q.fillCount ? Array.from({length: q.fillCount}).map(function(){return '<input type="text" value=""/>';}).join('') : q.stem;
		var answers = document.querySelector('.q-answers');
		answers.innerHTML = '';
		(q.options || []).forEach(function (text, index) {
			var el = document.createElement('div');
			el.className = 'q-answer';
			el.textContent = (index + 1) + '. ' + text;
			el.addEventListener('click', function () {
				el.classList.toggle('chosen');
			});
			answers.appendChild(el);
		});
		var line = document.querySelector('.line-feed');
		line.style.display = 'none';
		line.innerHTML = '';
		[].concat(q.hint).forEach(function (h) {
			var red = document.createElement('font');
			red.setAttribute('color', 'red');
			red.textContent = h;
			line.appendChild(red);
			var br = document.createElement('br');
			line.appendChild(br);
		});
	}
	renderNext();
	document.querySelector('.tips').addEventListener('click', function () {
		document.querySelector('.line-feed').style.display = '';
		window.__examLog.push('tips');
	});
	document.querySelector('.submit-btn').addEventListener('click', function () {
		var chosen = Array.prototype.map.call(document.querySelectorAll('.q-answer.chosen'), function (el) {
			return el.textContent.replace(/^\\d+\\.\\s*/, '');
		});
		var fills = Array.prototype.map.call(document.querySelectorAll('.q-body input'), function (el) { return el.value; });
		window.__examLog.push({ step: step, chosen: chosen, fills: fills });
		renderNext();
	});
</script>`
);

const POINTS_HTML = PAGE_SHELL('学习强国', '<div class="qrcode-box"><div>用学习强国扫码登录</div></div>');

// ---------------------------------------------------------------- HTTP 服务 --------------------------------------------

function startServer() {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url || '/', 'http://www.xuexi.cn');
		const send = (body, type = 'text/html; charset=utf-8') => {
			res.writeHead(200, { 'Content-Type': type });
			res.end(body);
		};
		if (url.pathname === '/' || url.pathname === '/index.html') return send(HOME_HTML);
		if (url.pathname === '/lgdata/index.json')
			return send(JSON.stringify({ DataSet: ['array-channel!mock-a.json', 'array-channel!mock-b.json'] }), 'application/json');
		if (url.pathname === '/lgdata/mock-a.json')
			return send(JSON.stringify(ARTICLES.map((a) => ({ itemId: a.id, url: a.url, title: a.title, type: 'tuwen', itemType: 'kNews' }))), 'application/json');
		if (url.pathname === '/lgdata/mock-b.json')
			return send(JSON.stringify(VIDEOS.map((v) => ({ itemId: v.id, url: v.url, title: v.title, type: 'shipin', itemType: 'kPureVideo' }))), 'application/json');
		if (url.pathname === '/lgpage/detail/index.html') {
			const id = url.searchParams.get('id') || '';
			if (id.startsWith('V')) return send(VIDEO_HTML);
			return send(articleHtml(id));
		}
		if (url.pathname === '/points/exam-practice.html') return send(EXAM_HTML);
		if (url.pathname === '/points/my-points.html') return send(POINTS_HTML);
		res.writeHead(404);
		res.end('not found');
	});
	return new Promise((resolve) => server.listen(8080, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------- GM 桥 --------------------------------------------

/** GM_* 桥：以 localStorage 为后端（同源共享），并在每次导航前自动注入 OCS。 */
function bridgeScript() {
	return `
window.__GM_STORE_PREFIX = 'gm:';
window.GM_info = { script: { name: 'OCS 网课助手', version: 'fixture', namespace: 'https://enncy.cn' } };
function __gmKey(key){ return window.__GM_STORE_PREFIX + key; }
window.GM_getValue = function (key, defaultValue) {
	try { var v = localStorage.getItem(__gmKey(key)); return v === null ? defaultValue : JSON.parse(v); } catch (e) { return defaultValue; }
};
window.GM_setValue = function (key, value) { localStorage.setItem(__gmKey(key), JSON.stringify(value === undefined ? null : value)); };
window.GM_deleteValue = function (key) { localStorage.removeItem(__gmKey(key)); };
window.GM_listValues = function () {
	var out = [];
	for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(window.__GM_STORE_PREFIX) === 0) out.push(k.slice(window.__GM_STORE_PREFIX.length)); }
	return out;
};
window.GM_xmlhttpRequest = function (details) {
	fetch(details.url, { method: details.method || 'GET', headers: details.headers || {} })
		.then(function (res) { return res.text().then(function (text) { details.onload && details.onload({ status: res.status, responseText: text, response: text }); }); })
		.catch(function (error) { details.onerror && details.onerror(error); });
	return { abort: function () {} };
};
window.GM_notification = function () {};
window.GM_getTab = function (cb) { cb && cb({}); };
window.GM_saveTab = function () {};
window.GM_getResourceText = function () { return ''; };
window.GM_addValueChangeListener = function () { return 0; };
window.GM_removeValueChangeListener = function () {};
window.unsafeWindow = window;
`;
}

// ---------------------------------------------------------------- 断言 --------------------------------------------

const checks = [];
function check(name, ok, detail) {
	checks.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 200) });
}

async function main() {
	const server = await startServer();
	const browser = await pw.chromium.launch({
		headless: true,
		executablePath: chromePath,
		args: ['--host-resolver-rules=MAP www.xuexi.cn 127.0.0.1:8080, MAP pc.xuexi.cn 127.0.0.1:8080', '--mute-audio']
	});
	const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'zh-CN' });
	await ctx.addInitScript(`${bridgeScript()}\n${ocsSource}`);
	// 预置配置（namespace.configName → GM 存储），把学习时长压到秒级便于测试。
	await ctx.addInitScript(() => {
		const preset = {
			'xuexi.home-v1.articleCount': 2,
			'xuexi.home-v1.videoCount': 2,
			'xuexi.home-v1.autoStart': false,
			'xuexi.study-v1.articleSeconds': 3,
			'xuexi.study-v1.maxVideoSeconds': 8,
			'xuexi.study-v1.videoRate': '1',
			'xuexi.study-v1.autoNext': true,
			'xuexi.exam-v1.stepDelayMs': 500,
			'xuexi.exam-v1.useAIWhenNoHint': false
		};
		try {
			for (const [key, value] of Object.entries(preset)) {
				localStorage.setItem('gm:' + key, JSON.stringify(value));
			}
		} catch (error) {
			console.log('[fixture] preset failed', error);
		}
	});

	const pageErrors = [];
	ctx.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200))));

	// ---------- 场景 1：门户 autostart ----------
	const page = await ctx.newPage();
	await page.goto('http://www.xuexi.cn/?autostart=1', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(3500);
	let state = await page.evaluate(() => ({ url: location.href, queue: JSON.parse(localStorage.getItem('ocs-xuexi-queue') || '[]') }));
	// autostart 会先弹出第一篇再进入，所以此刻队列剩 3 项。
	check('门户整理队列并弹出第一篇（剩 3 项）', state.queue.length === 3, JSON.stringify(state.queue.map((i) => i.id)));
	check(
		'剩余队列文章视频交替',
		state.queue[0] && state.queue[0].id === 'V2001' && state.queue[1] && state.queue[1].id === 'A1002' && state.queue[2] && state.queue[2].id === 'V2002',
		JSON.stringify(state.queue.map((i) => i.id))
	);
	check('autostart 直接跳到第一篇', /lgpage\/detail\/index\.html\?id=A1001/.test(state.url), state.url);

	// ---------- 场景 2/3/4：文章 → 视频 → 队列消费 ----------
	async function waitDone(extraIds, timeoutMs, label) {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const done = await page.evaluate(() => JSON.parse(localStorage.getItem('ocs-xuexi-done-list') || '[]')).catch(() => []);
			const missing = extraIds.filter((id) => !done.includes(id));
			if (!missing.length) return done;
			await page.waitForTimeout(1000);
		}
		return await page.evaluate(() => JSON.parse(localStorage.getItem('ocs-xuexi-done-list') || '[]')).catch(() => []);
	}

	let done = await waitDone(['A1001', 'V2001', 'A1002', 'V2002'], 60000, 'queue');
	check('文章 A1001 完成并标记', done.includes('A1001'), JSON.stringify(done));
	check('视频 V2001 完成（ended 后自动继续）', done.includes('V2001'), JSON.stringify(done));
	check('文章 A1002 完成', done.includes('A1002'), JSON.stringify(done));
	check('视频 V2002 完成', done.includes('V2002'), JSON.stringify(done));
	state = await page.evaluate(() => ({ url: location.href, queue: JSON.parse(localStorage.getItem('ocs-xuexi-queue') || '[]') }));
	check('队列全部消费完毕', state.queue.length === 0, JSON.stringify(state.queue));
	check('最终停留在详情页', /lgpage\/detail/.test(state.url), state.url);

	// ---------- 场景 5：每日答题 ----------
	await page.goto('http://pc.xuexi.cn/points/exam-practice.html', { waitUntil: 'domcontentloaded' });
	const examDeadline = Date.now() + 60000;
	let examLog = [];
	while (Date.now() < examDeadline) {
		examLog = await page.evaluate(() => window.__examLog || []).catch(() => []);
		// 只统计「提交」条目（对象），tips 点击记录是字符串。
		if (examLog.filter((entry) => typeof entry === 'object').length >= 3) break;
		await page.waitForTimeout(1000);
	}
	const submissions = examLog.filter((entry) => typeof entry === 'object');
	check('三道题都被提交', submissions.length >= 3, JSON.stringify(examLog));
	if (submissions.length >= 3) {
		check('单选命中官方提示（旅顺口）', submissions[0].chosen && submissions[0].chosen.includes('旅顺口'), JSON.stringify(submissions[0]));
		check(
			'多选命中两个官方提示',
			submissions[1].chosen && submissions[1].chosen.includes('指南针') && submissions[1].chosen.includes('造纸术'),
			JSON.stringify(submissions[1])
		);
		check('填空自动填写（上下而求索）', submissions[2].fills && submissions[2].fills[0] === '上下而求索', JSON.stringify(submissions[2]));
	}
	const finished = await page.evaluate(() => {
		const btn = document.querySelector('.ant-btn.action.ant-btn-primary');
		const header = document.querySelector('.q-header');
		return btn && btn.style.display !== 'none' && header && header.style.display === 'none';
	});
	check('答题完成态被识别', Boolean(finished), String(finished));

	// ---------- 场景 6：积分页扫码提示 ----------
	await page.goto('http://pc.xuexi.cn/points/my-points.html', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(5000);
	const pointsOk = await page.evaluate(() => !!document.querySelector('.qrcode-box')).catch(() => false);
	check('积分页扫码提示路径不报错', Boolean(pointsOk), String(pointsOk));

	// addInitScript 会在首个临时 about:blank 文档上执行，那个文档的 localStorage 一定抛
	// SecurityError（Tampermonkey/桌面端注入不存在这个瞬态文档），属于夹具环境差异，过滤掉。
	const knownInitErrors = pageErrors.filter(
		(error) => /SecurityError.*localStorage/i.test(error) || /localStorage.*Access is denied/i.test(error)
	);
	const unexpectedErrors = pageErrors.filter((error) => !knownInitErrors.includes(error));
	check('无页面级 JS 异常（localStorage 瞬态文档错误除外）', unexpectedErrors.length === 0, unexpectedErrors.join(' | '));

	await browser.close();
	server.close();

	const failed = checks.filter((item) => !item.ok);
	console.log(
		JSON.stringify(
			{ total: checks.length, failed: failed.length, checks },
			null,
			1
		)
	);
	process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
	console.error('FATAL', error);
	process.exit(1);
});
