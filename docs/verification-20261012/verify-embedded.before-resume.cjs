const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
	const appDir = path.resolve(__dirname, '../packages/app');
	const evidence = path.resolve(__dirname, '../docs/verification-20261012');
	fs.mkdirSync(evidence, { recursive: true });
	const profile = path.join(evidence, 'test-profile');
	fs.mkdirSync(profile, { recursive: true });
	const configPath = path.join(profile, 'config.json');
	const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
	config.render = { state: { first: false, setup: false }, browser: { currentBrowserUid: '', root: { uid: 'root', type: 'root', name: 'root', children: {}, createTime: 0, renaming: false } } };
	for (const [uid,name] of [['verificationA','测试浏览器 A'],['verificationB','测试浏览器 B']]) config.render.browser.root.children[uid] = {uid,name,type:'browser',parent:'root',createTime:Date.now(),renaming:false,checked:false,cachePath:'',tags:[],notes:'',histories:[],automationScripts:[]};
	fs.writeFileSync(configPath, JSON.stringify(config));
	const bootstrap = path.join(evidence, 'isolated-bootstrap.cjs');
	// Electron modules must be resolved inside the Electron runtime, not as its binary path.
	fs.writeFileSync(bootstrap, `const {app}=require('electron'); app.setPath('userData', ${JSON.stringify(path.join(evidence, 'test-profile'))}); require(${JSON.stringify(path.join(appDir, 'lib/index.js'))});`);
	const application = await electron.launch({ executablePath: require('electron'), args: [bootstrap], cwd: appDir });
	try {
		const page = await application.firstWindow();
		await page.route('https://ocsjs.com/**', route => route.fulfill({ status: 200, contentType:'application/json', body:'[]' }));
		await page.waitForSelector('.app-navigation', { timeout: 30000 });
		const errors = [];
		page.on('pageerror', e => errors.push(String(e)));
		await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/simple'); });
		await page.waitForSelector('.simple-mode-container');
		const deferInitialSetup = page.getByRole('button', { name: '稍后手动设置' });
		if (await deferInitialSetup.isVisible()) await deferInitialSetup.click();
		await page.locator('[data-uid="verificationA"]').getByRole('button',{name:'内嵌打开',exact:true}).click();
		await page.waitForFunction(() => { try { return document.querySelector('webview')?.getWebContentsId() > 0; } catch { return false; } });
		const firstId = await page.evaluate(() => document.querySelector('webview').getWebContentsId());
		await page.evaluate(async () => {
			const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router;
			await router.push('/browsers');
			await router.push('/browser/verificationB');
		});
		await page.waitForFunction(() => { try { return [...document.querySelectorAll('webview')].length === 2 && [...document.querySelectorAll('webview')].every(v => v.getWebContentsId() > 0); } catch { return false; } });
		const ids = await page.evaluate(() => [...document.querySelectorAll('webview')].map(v => v.getWebContentsId()));
		if (ids[0] !== firstId || ids[0] === ids[1]) throw Error('Guest replaced or reused');
		const deferSetup = page.getByRole('button', { name: '稍后手动设置' });
		if (await deferSetup.isVisible()) await deferSetup.click();
		await page.getByRole('button', { name: '题库设置', exact: true }).click();
		await page.waitForSelector('.question-bank');
		await page.getByRole('button', { name: '题库设置', exact: true }).waitFor({ state: 'visible' });
		const afterQuestionBank = await page.evaluate(() => [...document.querySelectorAll('webview')].map(v => v.getWebContentsId()));
		if (afterQuestionBank[0] !== firstId || afterQuestionBank[1] !== ids[1]) throw Error('Opening settings destroyed guests');
		await page.screenshot({ path: path.join(evidence, 'question-bank-navigation.png') });
		const storageResult = await application.evaluate(async ({ webContents }) => {
			const guests = webContents.getAllWebContents().filter(v => v.getType() === 'webview');
			const first = guests[0], second = guests[1];
			await first.executeJavaScript("window.__ocsGMStorage.call('set','verification:questionBank',{endpoint:'http://localhost/query'})");
			await first.loadURL('http://127.0.0.1:3000/');
			const acrossOrigin = await first.executeJavaScript("window.__ocsGMStorage.call('get','verification:questionBank')");
			const otherProfile = await second.executeJavaScript("window.__ocsGMStorage.call('get','verification:questionBank')");
			return { acrossOrigin, otherProfile: otherProfile ?? null };
		});
		if (storageResult.acrossOrigin?.endpoint !== 'http://localhost/query' || storageResult.otherProfile !== null) throw Error('Storage persistence/isolation failed');
		await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/simple'); });
		await page.waitForSelector('.simple-mode-container');
		const afterSimple = await page.evaluate(() => [...document.querySelectorAll('webview')].map(v => v.getWebContentsId()));
		if (afterSimple[0] !== firstId) throw Error('Simple mode destroyed guest');
		// Exercise real clicks: no programmatic navigation or overlay bypass.
		const switchButton = page.getByRole('button', { name: '切换到窗口', exact: true }).first();
		await switchButton.click();
		await page.waitForSelector('.embedded-browser-page', { state: 'visible' });
		for (let i = 0; i < 3; i++) {
			await page.locator('.embedded-browser-page:visible').getByRole('button', { name: '返回列表', exact: true }).click();
			await page.locator('.mode-switch').click();
			await page.locator('.session-name').first().click();
			await page.waitForSelector('.embedded-browser-page', { state: 'visible' });
		}
		await page.evaluate(() => { document.querySelectorAll('.arco-notification-list,.arco-message-list').forEach(el => el.style.display = 'none'); });
		await page.screenshot({ path: path.join(evidence, 'ocs-two-browsers.png') });
		await page.locator('.session-close').last().click();
		await page.waitForFunction(() => document.querySelectorAll('webview').length === 1);
		const surviving = await page.evaluate(() => document.querySelector('webview').getWebContentsId());
		if (surviving !== firstId) throw Error('Closing B destroyed A');
		const report = { firstId, simultaneousIds: ids, afterQuestionBank, afterSimple, surviving, storageResult, errors };
		fs.writeFileSync(path.join(evidence, 'embedded-result.json'), JSON.stringify(report, null, 2));
		console.log(JSON.stringify(report));
	} finally { await application.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
