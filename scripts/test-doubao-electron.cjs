// Offline integration: real Electron encryption, real frozen gateway, isolated profile.
const { app } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const profile = path.resolve(__dirname, '../docs/doubao-integration/test-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
	const applicationRoot = process.env.DOUBAO_TEST_APP_ROOT || path.resolve(__dirname, '../packages/app');
	process.env.DOUBAO_PYTHON = 'missing-python-must-use-bundled-runtime';
	const service = require(path.join(applicationRoot, 'lib/src/services/doubao'));
	const bank = require(path.join(applicationRoot, 'lib/src/services/question-bank'));
	const crypto = require(path.join(applicationRoot, 'lib/src/crypto'));
	let assertions = 0;
	const check = (condition) => {
		assert(condition);
		assertions++;
	};
	try {
		const initial = await service.getDoubaoStatus();
		check(initial.running && !initial.loggedIn);
		check(initial.models.length === 6);
		const config = bank.getQuestionBankConfig();
		check(config.selectedProviderId === 'builtin-doubao');
		check(config.providers.some((p) => p.id === 'builtin-doubao'));
		const external = {
			id: 'existing-provider',
			name: 'Existing custom model',
			model: 'custom',
			protocol: 'openai-chat',
			baseUrl: 'https://example.com/v1',
			enabled: true
		};
		bank.saveQuestionBankConfig({ providers: [external], selectedProviderId: external.id, autoSaveAiAnswers: true });
		check(bank.getQuestionBankConfig().selectedProviderId === external.id);
		check(bank.getQuestionBankConfig().providers.some((p) => p.id === 'builtin-doubao'));
		bank.saveQuestionBankConfig(config);
		await assert.rejects(service.importDoubaoCookie('sessionid=dummy'), /缺少 Cookie/);
		assertions++;
		await assert.rejects(service.pollDoubaoQr('does-not-exist'));
		assertions++;
		const dummy = [
			'sessionid',
			'sessionid_ss',
			'sid_tt',
			'sid_guard',
			'uid_tt',
			'uid_tt_ss',
			'd_ticket',
			'ttwid',
			's_v_web_id',
			'passport_csrf_token'
		]
			.map((name) => `${name}=offline-test-only`)
			.join('; ');
		check((await service.importDoubaoCookie(dummy)).loggedIn);
		const webQrCookie = dummy.split('; ').filter((part) => !part.startsWith('d_ticket=') && !part.startsWith('s_v_web_id=')).join('; ');
		check((await service.importDoubaoCookie(webQrCookie)).loggedIn);
		await service.importDoubaoCookie(dummy);
		const encrypted = fs.readFileSync(path.join(profile, 'doubao/session.enc'), 'utf8');
		check(!encrypted.includes('offline-test-only'));
		check(crypto.decryptRenderString(encrypted) === dummy);
		await assert.rejects(
			bank.queryQuestionBank({ title: 'offline image rejection test', images: ['data:image/png;base64,AA=='] }),
			/支持文本题目/
		);
		assertions++;
		const saved = bank.saveQuestionBankQuestion({ title: '集成测试：1+1', answer: '2', source: 'manual' });
		check((await bank.queryQuestionBank({ title: saved.title })).source === 'bank');
		check(bank.deleteQuestionBankQuestion(saved.id));
		const out = await service.logoutDoubao();
		check(!out.loggedIn && out.running);
		check(!fs.existsSync(path.join(profile, 'doubao/session.enc')));
		console.log(`PASS: ${assertions} Electron/gateway integration assertions (no upstream requests).`);
	} catch (error) {
		process.exitCode = 1;
		console.error(error.message);
	} finally {
		if (process.env.DOUBAO_TEST_EXIT_NOW === '1') app.exit(process.exitCode || 0);
		else app.quit();
	}
});
