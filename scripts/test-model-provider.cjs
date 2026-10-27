// Local HTTP fixtures and real Electron encryption; no upstream model requests.
const { app } = require('electron');
const assert = require('assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const profile = path.resolve(__dirname, '../docs/model-sync-20261027/provider-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
	const bank = require('../packages/app/lib/src/services/question-bank');
	const providerApi = require('../packages/app/lib/src/services/model-provider');
	const seen = [];
	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://localhost');
		let body = '';
		for await (const chunk of req) body += chunk;
		seen.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body });
		res.setHeader('Content-Type', 'application/json');
		let data;
		if (url.pathname === '/error/models') {
			res.statusCode = 401;
			data = { error: { message: 'invalid key: test/key test%2Fkey' } };
		} else if (url.pathname === '/missing/models') {
			res.statusCode = 404;
			data = { message: 'Not found' };
		} else if (url.pathname === '/html/models') data = '<html>not an API</html>';
		else if (url.pathname === '/empty/models') data = { data: [] };
		else if (url.pathname === '/loop/models') data = { data: [{ id: 'a' }], has_more: true, last_id: 'a' };
		else if (url.pathname === '/anthropic/v1/models') {
			data = url.searchParams.has('after_id')
				? { data: [{ id: 'b', display_name: 'Claude B' }], has_more: false }
				: { data: [{ id: 'a', display_name: 'Claude A' }], has_more: true, last_id: 'a' };
		} else if (url.pathname === '/v1beta/models') {
			data = url.searchParams.has('pageToken')
				? { models: [{ name: 'models/gemini-b' }] }
				: {
						models: [
							{ name: 'models/gemini-a', displayName: 'Gemini A', supportedGenerationMethods: ['generateContent'] },
							{ name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }
						],
						nextPageToken: 'next'
				  };
		} else if (url.pathname.endsWith('/models'))
			data = { data: [{ id: 'fixture-chat' }, { id: 'fixture-chat' }, null, { id: 'second-chat' }] };
		else if (url.pathname.endsWith('/chat/completions'))
			data = { choices: [{ message: { content: '{"answer":"OK"}' } }] };
		else if (url.pathname.endsWith('/messages')) data = { content: [{ type: 'text', text: '{"answer":"OK"}' }] };
		else if (url.pathname.endsWith(':generateContent'))
			data = { candidates: [{ content: { parts: [{ text: '{"answer":"OK"}' }] } }] };
		else {
			res.statusCode = 404;
			data = { message: 'unexpected route' };
		}
		res.end(JSON.stringify(data));
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const base = `http://127.0.0.1:${server.address().port}`;
	const provider = {
		id: 'fixture-provider',
		name: 'Fixture',
		protocol: 'openai-chat',
		baseUrl: base,
		model: 'fixture-chat',
		apiKey: 'test/key',
		enabled: true
	};
	let assertions = 0;
	function equal(actual, expected) {
		assert.deepEqual(actual, expected);
		assertions++;
	}
	async function rejects(action, pattern) {
		await assert.rejects(action, pattern);
		assertions++;
	}
	try {
		for (const [address, endpoint] of [
			[base, `${base}/v1/chat/completions`],
			[`${base}/v1/`, `${base}/v1/chat/completions`],
			[`${base}/compatible-mode/v1`, `${base}/compatible-mode/v1/chat/completions`],
			[`${base}/api`, `${base}/api/chat/completions`],
			[`${base}/v4`, `${base}/v4/chat/completions`],
			[`${base}/chat/completions`, `${base}/chat/completions`]
		]) {
			equal(providerApi.modelEndpoint({ ...provider, baseUrl: address }), endpoint);
			equal(
				(await bank.listQuestionBankModels({ ...provider, model: '', baseUrl: address })).map((m) => m.id),
				['fixture-chat', 'second-chat']
			);
		}
		equal(seen.at(-1).headers.authorization, 'Bearer test/key');
		const anthropic = { ...provider, protocol: 'anthropic', baseUrl: `${base}/anthropic/v1/messages` };
		equal(
			(await bank.listQuestionBankModels(anthropic)).map((m) => m.id),
			['a', 'b']
		);
		equal(seen.at(-1).query.after_id, 'a');
		equal(seen.at(-1).headers['x-api-key'], 'test/key');
		equal((await bank.testQuestionBankProvider(anthropic)).ok, true);
		const gemini = {
			...provider,
			protocol: 'gemini',
			baseUrl: `${base}/v1beta/models/gemini-a:generateContent`,
			model: 'models/gemini-a'
		};
		equal(
			(await bank.listQuestionBankModels(gemini)).map((m) => m.id),
			['gemini-a', 'gemini-b']
		);
		equal(seen.at(-1).query.pageToken, 'next');
		equal(seen.at(-1).headers['x-goog-api-key'], 'test/key');
		equal((await bank.testQuestionBankProvider(gemini)).ok, true);
		equal(seen.at(-1).path, '/v1beta/models/gemini-a:generateContent');
		equal(seen.at(-1).query, {});

		let config = bank.saveQuestionBankConfig({
			providers: [{ ...provider, baseUrl: `${base}/api` }],
			selectedProviderId: provider.id,
			autoSaveAiAnswers: true
		});
		const publicProvider = config.providers.find((p) => p.id === provider.id);
		equal(publicProvider.apiKey, '');
		equal(publicProvider.hasApiKey, true);
		const encryptedPath = path.join(profile, 'question-bank/settings.enc');
		const beforeFetch = fs.readFileSync(encryptedPath, 'utf8');
		equal(beforeFetch.includes('test/key'), false);
		await bank.listQuestionBankModels(publicProvider);
		equal(seen.at(-1).headers.authorization, 'Bearer test/key');
		equal(fs.readFileSync(encryptedPath, 'utf8'), beforeFetch);
		await bank.listQuestionBankModels({ ...publicProvider, clearApiKey: true });
		equal(seen.at(-1).headers.authorization, undefined);
		equal((await bank.testQuestionBankProvider({ ...publicProvider, clearApiKey: true })).ok, true);
		equal(seen.at(-1).headers.authorization, undefined);
		const answer = await bank.queryQuestionBank({ title: `Fixture question ${Date.now()}` });
		equal(answer.answer, 'OK');
		equal(seen.at(-1).path, '/api/chat/completions');

		await rejects(
			() => bank.listQuestionBankModels({ ...provider, baseUrl: `${base}/error` }),
			/HTTP 401.*\[已隐藏\].*\[已隐藏\]/
		);
		await rejects(() => bank.listQuestionBankModels({ ...provider, baseUrl: `${base}/missing` }), /手动填写模型 ID/);
		await rejects(() => bank.listQuestionBankModels({ ...provider, baseUrl: `${base}/html` }), /有效的模型列表/);
		await rejects(() => bank.listQuestionBankModels({ ...provider, baseUrl: `${base}/empty` }), /未返回可用/);
		await rejects(() => bank.listQuestionBankModels({ ...anthropic, baseUrl: `${base}/loop` }), /分页重复/);
		for (const invalid of ['ftp://localhost', `${base}/?key=secret`, 'http://user:pass@localhost', 'not-a-url']) {
			const count = seen.length;
			await rejects(() => bank.listQuestionBankModels({ ...provider, baseUrl: invalid }), /服务地址/);
			equal(seen.length, count);
		}
		equal(bank.getQuestionBankConfig().selectedProviderId, provider.id);
		const report = { assertions, upstreamRequests: 0, localRequests: seen.length, result: 'PASS' };
		fs.writeFileSync(path.resolve(profile, '../provider-result.json'), JSON.stringify(report, null, 2));
		console.log(JSON.stringify(report));
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	} finally {
		server.closeAllConnections();
		server.close();
		app.exit(process.exitCode || 0);
	}
});
