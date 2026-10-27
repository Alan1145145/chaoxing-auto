const { _electron: electron } = require('playwright-core');
const assert = require('assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async () => {
	const evidence = path.resolve(__dirname, '../docs/model-sync-20261027');
	const profile = fs.mkdtempSync(path.join(evidence, 'ui-profile-'));
	fs.writeFileSync(
		path.join(profile, 'config.json'),
		JSON.stringify({
			version: '0.0.0',
			render: {
				state: { first: false, setup: false, newBrowserSetup: false },
				notifies: [{ id: 'chaoxing-auto-tutorial-1.0.0', content: [] }]
			}
		})
	);
	const modelRequests = [];
	const mock = http.createServer(async (req, res) => {
		let body = '';
		for await (const chunk of req) body += chunk;
		modelRequests.push({ url: req.url, authorization: req.headers.authorization, body });
		res.setHeader('Content-Type', 'application/json');
		if (req.headers.authorization === 'Bearer invalid-fixture-key') {
			res.writeHead(401).end(JSON.stringify({ error: { message: 'invalid key invalid-fixture-key' } }));
		} else if (req.url.endsWith('/models')) {
			res.end(JSON.stringify({ data: [{ id: 'fixture-chat' }, { id: 'fixture-other' }] }));
		} else if (req.url.endsWith('/chat/completions')) {
			res.end(JSON.stringify({ choices: [{ message: { content: '{"answer":"本地测试答案"}' } }] }));
		} else res.writeHead(404).end('{}');
	});
	await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
	const base = `http://127.0.0.1:${mock.address().port}/proxy/v4`;
	const application = await electron.launch({
		executablePath: require('electron'),
		args: [path.join(__dirname, 'model-test-bootstrap.cjs')],
		cwd: path.resolve(__dirname, '../packages/app'),
		env: { ...process.env, MODEL_TEST_PROFILE: profile }
	});
	let assertions = 0;
	const check = (value, message) => {
		assert(value, message);
		assertions++;
	};
	async function waitForCourse(predicate) {
		const deadline = Date.now() + 15000;
		let state;
		while (Date.now() < deadline) {
			state = await application.evaluate(() => globalThis.__modelTest.courseState());
			if (predicate(state)) return state;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		const messages = await application.evaluate(() => globalThis.__modelTest.messages);
		const probe = await application.evaluate(() =>
			globalThis.__modelTest.course.webContents.executeJavaScript(`new Promise((resolve) => {
			const timer = setTimeout(() => resolve({ error: 'GM timeout' }), 2000);
			GM_xmlhttpRequest({ url: 'http://localhost:15319/ocs-global-setting', responseType: 'json',
				onload: (res) => { clearTimeout(timer); resolve({ status: res.status, text: res.responseText }); },
				onerror: (error) => { clearTimeout(timer); resolve(error); } });
		})`)
		);
		throw new Error(`Course state timeout: ${JSON.stringify({ state, messages, probe })}`);
	}
	try {
		const page = await application.firstWindow();
		await page.waitForSelector('.app-navigation');
		const errors = [];
		page.on('pageerror', (error) => errors.push(String(error)));
		await application.evaluate(() => globalThis.__modelTest.openCourse());
		const initial = await waitForCourse(
			(state) => state.top.ready && state.frame?.ready && state.top.status === 'not_open_sync'
		);
		await page.getByRole('button', { name: '模型接入', exact: true }).click();
		await page.locator('.model-toolbar').getByRole('button', { name: '添加模型', exact: false }).click();
		const modal = page.locator('.arco-modal:visible').filter({ hasText: '添加模型接入' });
		await modal.getByRole('button', { name: '确定', exact: true }).click();
		check(await modal.isVisible(), 'Validation failure closed the editor');
		await modal.getByPlaceholder('例如：DeepSeek', { exact: true }).fill('自动同步测试模型');
		await modal.getByPlaceholder('https://api.openai.com/v1', { exact: true }).fill(base);
		await modal.getByPlaceholder('输入 API Key', { exact: true }).fill('fixture-key-only');
		await modal.getByRole('button', { name: '一键获取模型', exact: true }).click();
		await modal.getByText('已获取 2 个模型，可搜索选择，也可手动输入模型 ID。').waitFor();
		check(modelRequests.at(-1).url === '/proxy/v4/models', 'Custom API prefix changed');
		check(modelRequests.at(-1).authorization === 'Bearer fixture-key-only', 'New key not used');
		await modal.getByRole('button', { name: '测试连接', exact: true }).click();
		await page.getByText(/模型连接成功，耗时/).waitFor();
		await page.screenshot({ path: path.join(evidence, 'model-picker.png') });
		await modal.getByRole('button', { name: '确定', exact: true }).click();
		await modal.waitFor({ state: 'hidden' });
		await page.waitForFunction(() => document.querySelector('.ocs-save-status')?.dataset.state === 'success');
		const integration = await application.evaluate(() => globalThis.__modelTest.configState());
		check(integration.provider?.id === integration.selectedId, 'New provider not selected');
		check(integration.provider.apiKey === '' && integration.provider.hasApiKey, 'Saved key missing or exposed');
		check(integration.config.openSync === true, 'OCS sync not enabled by modal save');
		check(
			integration.config.store['common.settings.answererWrappers'][0].url === 'http://localhost:15319/query',
			'Answerer missing from server'
		);
		const synced = await waitForCourse(
			(state) =>
				state.top.wrappers.length === 1 &&
				state.frame?.wrappers.length === 1 &&
				state.top.status === 'synced' &&
				state.frame.status === 'synced'
		);
		check(
			synced.top.timeOrigin === initial.top.timeOrigin && synced.frame.timeOrigin === initial.frame.timeOrigin,
			'Sync reloaded a course page'
		);
		const answer = await application.evaluate(() =>
			globalThis.__modelTest.course.webContents.executeJavaScript(`new Promise((resolve, reject) => {
			const wrapper = GM_getValue('common.settings.answererWrappers')[0];
			GM_xmlhttpRequest({ url: wrapper.url + '?title=offline-sync-test&type=single', responseType: 'json',
				onload: (response) => { try { resolve(new Function(wrapper.handler)()(response.response)); } catch (e) { reject(e); } },
				onerror: reject });
		})`)
		);
		check(answer[1] === '本地测试答案', 'OCS answerer did not reach the selected model');
		check(JSON.parse(modelRequests.at(-1).body).model === 'fixture-chat', 'Wrong upstream model used');

		const providerCard = page.locator('.provider-card').filter({ hasText: '自动同步测试模型' });
		await providerCard.getByTitle('配置模型', { exact: true }).click();
		const edit = page.locator('.arco-modal:visible').filter({ hasText: '编辑模型接入' });
		await edit.getByRole('button', { name: '一键获取模型', exact: true }).click();
		await edit.getByText('已获取 2 个模型，可搜索选择，也可手动输入模型 ID。').waitFor();
		check(modelRequests.at(-1).authorization === 'Bearer fixture-key-only', 'Saved key not reused in editor');
		await edit.getByPlaceholder('留空以保留已保存的密钥', { exact: true }).fill('invalid-fixture-key');
		await edit.getByRole('button', { name: '一键获取模型', exact: true }).click();
		await edit.locator('.arco-alert').filter({ hasText: 'HTTP 401' }).waitFor();
		check(!(await edit.locator('.arco-alert').innerText()).includes('invalid-fixture-key'), 'API key leaked in error');
		check(await edit.isVisible(), 'Fetch error closed editor');
		await edit.getByRole('button', { name: '取消', exact: true }).click();
		await page
			.locator('.provider-card')
			.filter({ hasText: '内置豆包' })
			.getByRole('button', { name: '选为默认模型 ↗', exact: true })
			.click();
		await page.waitForFunction(() => document.querySelector('.provider-card.selected h3')?.textContent === '内置豆包');
		await page.waitForFunction(() => document.querySelector('.ocs-save-status')?.dataset.state === 'success');
		check(
			(await application.evaluate(() => globalThis.__modelTest.configState().selectedId)) === 'builtin-doubao',
			'Default choice was not persisted automatically'
		);
		await providerCard.getByRole('button', { name: '选为默认模型 ↗', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('.ocs-save-status')?.dataset.state === 'success');

		await application.evaluate(() =>
			globalThis.__modelTest.course.webContents.executeJavaScript("GM_setValue('background.app.closeSync', true)")
		);
		await page.evaluate(() => {
			window.store.render.setting.ocs.store['common.settings.modelSyncProbe'] = 'updated';
		});
		await waitForCourse((state) => state.frame?.probe === 'updated');
		const optedOut = await application.evaluate(() => globalThis.__modelTest.courseState());
		check(optedOut.top.probe !== 'updated', 'Explicit per-page sync opt-out was ignored');
		await application.evaluate(() =>
			globalThis.__modelTest.course.webContents.executeJavaScript("GM_setValue('background.app.closeSync', false)")
		);
		const resumed = await waitForCourse((state) => state.top.probe === 'updated');
		check(resumed.top.timeOrigin === initial.top.timeOrigin, 'Resuming sync reloaded the page');
		check(errors.length === 0, `Renderer errors: ${errors.join('; ')}`);
		await page.screenshot({ path: path.join(evidence, 'model-auto-sync.png') });
		const report = {
			applicationRoot: process.env.MODEL_TEST_APP_ROOT || path.resolve(__dirname, '../packages/app'),
			result: 'PASS',
			assertions,
			rendererErrors: errors,
			noCourseReload: true,
			topAndFrameSynced: true,
			modelRequests: modelRequests.length,
			selectedProvider: integration.provider.id,
			profile
		};
		fs.writeFileSync(path.join(evidence, 'ui-result.json'), JSON.stringify(report, null, 2));
		console.log(JSON.stringify(report));
	} finally {
		await application.close();
		mock.closeAllConnections();
		mock.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
