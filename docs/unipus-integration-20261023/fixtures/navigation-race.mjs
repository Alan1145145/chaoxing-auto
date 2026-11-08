/**
 * U校园 一键学习 · 导航抖动夹具
 *
 * 复现用户上报的 `page.evaluate: Execution context was destroyed, most likely because of a navigation`：
 * 每个页面在被脚本操作的同时都会再跳转一次（SSO 自刷新、班课列表 SPA 刷新、目录页重载、学习页重载），
 * 因此 evaluate / fill / click 有可能正好落在跳转瞬间。
 *
 * 判定标准：
 *   1. injectedNavErrors > 0 —— 夹具确实把 “Execution context was destroyed” 打出来了；
 *   2. errors 为空 —— 自动化没有把这类错误当成业务失败抛给用户；
 *   3. started === true —— 最终仍然完成了 登录 → 班课 → 课程 → 学习页 → 助手接管。
 *
 * 夹具分两层制造竞态：
 *   - 真实层：每类页面加载后自己再跳转一次，让 evaluate 落在真实卸载过程中；
 *   - 注入层：对每个新地址的第一次 evaluate / fill 直接抛 Playwright 原文错误，
 *     保证「跳转瞬间 evaluate」这一时序每次都能命中，不依赖机器快慢。
 *
 * 运行（需先 `pnpm --filter @ocs-desktop/app exec tsc`）：
 *   node docs/unipus-integration-20261023/fixtures/navigation-race.mjs
 *
 * 账号密码是夹具占位值，不含任何真实凭据。
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../../../packages/app');
// pnpm 把 playwright-core 提升到仓库根 node_modules，从 packages/app 的角度去解析才稳定。
const appRequire = createRequire(path.join(appRoot, 'index.js'));
const playwright = appRequire('playwright-core');
const { UnipusOpenScript } = require(path.join(appRoot, 'lib/src/scripts/automation/wk/unipus.js'));

const PAGE_HEAD = '<meta charset="utf-8"><title>U校园</title>';
/** 页面加载后自己再跳一次的时间点：400ms 落在等待稳定的窗口内，2200ms 落在后续操作窗口内。 */
const EARLY_AT = 400;
const LATE_AT = 2200;

const state = { logged: false, studentVisits: 0, races: 0 };

const forbidden = `<!doctype html><html><head>${PAGE_HEAD.replace('U校园', '403 Forbidden')}</head>
<body bgcolor="white"><center><h1>403 Forbidden</h1></center><hr><center>openresty</center></body></html>`;

/** 让页面在脚本操作途中自己再跳一次，制造 “Execution context was destroyed”。 */
function raceOnce(target, at) {
	state.races += 1;
	return `<script>setTimeout(function () { location.replace(${JSON.stringify(target)}); }, ${at});</script>`;
}

const loginStartPage = `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<div id="app">正在跳转 ...</div>
${raceOnce('https://sso.unipus.cn/sso/login?service=u', EARLY_AT)}
</body></html>`;

const ssoPage = (search) => `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<h2>统一身份认证</h2>
<div>
  <input name="username" autocomplete="username" />
  <input name="password" type="password" autocomplete="current-password" />
  <button id="login">登录</button>
</div>
<script>
  var submitted = false;
  document.getElementById('login').addEventListener('click', function () {
    if (submitted) return;
    submitted = true;
    setTimeout(function () { location.href = 'https://u.unipus.cn/user/comm/login?ticket=ok'; }, 120);
  });
</script>
${search.includes('sub=1') ? '' : raceOnce('https://sso.unipus.cn/sso/login?service=u&sub=1', EARLY_AT)}
</body></html>`;

const ticketPage = `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<p>ticket accepted</p>
<script>location.replace('https://u.unipus.cn/user/student');</script>
</body></html>`;

const courseListPage = (search) => `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<div class="my_course_box">
  <ul class="my_course_list">
    <li class="my_course_item">
      <a href="https://u.unipus.cn/course/1">大学英语（一） 2026秋</a>
    </li>
    <li class="my_course_item">
      <a href="https://u.unipus.cn/course/2">大学英语（二） 2026春</a>
    </li>
  </ul>
</div>
${search.includes('nav=1') ? '' : raceOnce('https://u.unipus.cn/user/student?nav=1', LATE_AT)}
</body></html>`;

const coursePage = (search) => `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<h1>大学英语（一） 2026秋</h1>
<a class="start-btn" href="https://ucontent.unipus.cn/study/1">继续学习</a>
${search.includes('nav=1') ? '' : raceOnce('https://u.unipus.cn/course/1?nav=1', LATE_AT)}
</body></html>`;

const contentPage = (search) => `<!doctype html><html><head>${PAGE_HEAD}</head><body>
<div id="course-app">课程学习</div>
<script>
  setTimeout(function () {
    if (document.getElementById('unipus-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'unipus-panel';
    panel.style.display = 'flex';
    panel.textContent = 'U校园刷课助手 v1.3.11 目录扫描成功，自动开始刷课';
    document.body.appendChild(panel);
    var ball = document.createElement('div');
    ball.id = 'unipus-ball';
    document.body.appendChild(ball);
    var log = document.createElement('div');
    log.id = 'unipus-log';
    log.textContent = 'v1.3.11 目录扫描成功 自动开始刷课';
    document.body.appendChild(log);
  }, 260);
</script>
${search.includes('nav=1') ? '' : raceOnce('https://ucontent.unipus.cn/study/1?nav=1', LATE_AT)}
</body></html>`;

function respond(url) {
	const parsed = new URL(url);
	const host = parsed.hostname;
	const search = parsed.search;

	if (host === 'u.unipus.cn') {
		if (parsed.pathname === '/user/comm/login') {
			if (search.includes('ticket=ok')) {
				state.logged = true;
				return { status: 200, body: ticketPage };
			}
			return { status: 200, body: loginStartPage };
		}
		if (parsed.pathname === '/user/student') {
			state.studentVisits += 1;
			if (!state.logged) return { status: 403, body: forbidden };
			return { status: 200, body: courseListPage(search) };
		}
		if (parsed.pathname === '/course/1') return { status: 200, body: coursePage(search) };
		if (parsed.pathname === '/course/2') return { status: 200, body: coursePage(search) };
		return { status: 404, body: `<!doctype html><html><head>${PAGE_HEAD}</head><body>404</body></html>` };
	}

	if (host === 'sso.unipus.cn') return { status: 200, body: ssoPage(search) };
	if (host === 'ucontent.unipus.cn') return { status: 200, body: contentPage(search) };

	return { status: 404, body: '<html><body>404</body></html>' };
}

async function main() {
	// 复用本机已装的 Chromium，避免夹具依赖 playwright 自带版本的下载状态。
	const executablePath =
		process.env.UNIPUS_FIXTURE_CHROME ||
		([
			path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
			path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1200/chrome-win64/chrome.exe')
		].find((candidate) => candidate && require('node:fs').existsSync(candidate)) ??
			undefined);

	const browser = await playwright.chromium.launch({ headless: true, executablePath });
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.route('**/*', async (route) => {
		const { status, body } = respond(route.request().url());
		await route.fulfill({ status, contentType: 'text/html; charset=utf-8', body });
	});

	// 统计真实导航竞态：脚本内部被重试吞掉的错误都在这里计一次。
	const rawEvaluate = page.evaluate.bind(page);
	const rawFill = page.fill.bind(page);
	const rawClick = page.click.bind(page);
	const navPattern =
		/Execution context was destroyed|Cannot find context with specified id|Navigating frame was detached|frame was detached/i;
	let realNavErrors = 0;
	let injectedNavErrors = 0;
	// 每个地址只注入一次：模拟「evaluate 恰好落在跳转瞬间」的时序，保证不依赖机器快慢。
	const injectedUrls = new Set();
	const maybeInject = () => {
		const url = page.url();
		if (injectedUrls.has(url)) return false;
		injectedUrls.add(url);
		injectedNavErrors += 1;
		const error = new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation');
		return error;
	};
	const wrap =
		(fn, injectable) =>
		async (...args) => {
			if (injectable) {
				const injected = maybeInject();
				if (injected) throw injected;
			}
			try {
				return await fn(...args);
			} catch (error) {
				if (navPattern.test(String(error && error.message))) realNavErrors += 1;
				throw error;
			}
		};
	page.evaluate = wrap(rawEvaluate, true);
	page.fill = wrap(rawFill, true);
	page.click = wrap(rawClick, false);

	const logs = [];
	const errors = [];
	UnipusOpenScript.on('script-data', (message) => logs.push(String(message)));
	UnipusOpenScript.on('script-error', (message) => errors.push(String(message)));

	const startedAt = Date.now();
	await UnipusOpenScript.run(page, {
		// 故意用旧的 /user/student：第一次必然 403，必须先恢复登录。
		url: 'https://u.unipus.cn/user/student',
		autoLogin: true,
		phone: '13900000000',
		password: 'fixture-pass',
		courseKeyword: '大学英语（一）',
		autoEnterCourse: true,
		autoStartLearning: true,
		loginTimeout: 40,
		startTimeout: 60
	});
	const elapsedMs = Date.now() - startedAt;

	const seeded = await rawEvaluate(() => ({
		panelOpen: localStorage.getItem('unipus_panel_open'),
		purpose: localStorage.getItem('unipus_study_purpose_confirmed'),
		provider: localStorage.getItem('unipus_ai_provider')
	}));

	const result = {
		elapsedMs,
		finalUrl: page.url(),
		realNavErrors,
		injectedNavErrors,
		fixtureRaces: state.races,
		studentVisits: state.studentVisits,
		seeded,
		logs,
		errors,
		started: logs.some((line) => /已接管|已开始/.test(line))
	};

	console.log(JSON.stringify(result, null, 2));

	await browser.close();

	if (errors.length || !result.started || injectedNavErrors === 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
