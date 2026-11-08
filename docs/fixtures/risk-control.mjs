/**
 * 模型风控/限流韧性夹具。
 *
 * 复现真实反馈里的报错：
 *   rate limited (风控要求验证: type=verify subtype=semantic_reasoning) [logid=...]
 * 并验证韧性层的行为：
 *   1) 选中模型命中风控 → 冷却 + 自动改用备用模型，题目仍然答出来；
 *   2) 冷却期内不再打被风控的模型（请求次数不增加）；
 *   3) 所有模型都风控 → 抛出可读提示（含「风控」「换模型」），不再是上游原文；
 *   4) 内置豆包处于冷却时直接快速失败，不再压网关。
 *
 * 运行：
 *   node docs/fixtures/risk-control.mjs
 *   APP_ROOT=<安装包解包后的 resources/app> node docs/fixtures/risk-control.mjs
 * 前置：已执行 `cd packages/app && npx tsc -p tsconfig.json`。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const appRoot = path.resolve(process.env.APP_ROOT || 'packages/app');
const questionBankPath = path.join(appRoot, 'lib/src/services/question-bank.js');
const doubaoPath = path.join(appRoot, 'lib/src/services/doubao.js');
const resiliencePath = path.join(appRoot, 'lib/src/services/provider-resilience.js');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-108-risk-'));
const logs = path.join(userData, 'logs');
fs.mkdirSync(logs, { recursive: true });

const load = require('module')._load;
require('module')._load = function (request) {
	if (request === 'electron') {
		return {
			app: {
				getPath: (name) => (name === 'logs' ? logs : userData),
				getVersion: () => '1.0.8',
				isPackaged: false,
				on: () => {},
				whenReady: () => Promise.resolve()
			},
			safeStorage: {
				isEncryptionAvailable: () => true,
				encryptString: (text) => Buffer.from(String(text), 'utf8'),
				decryptString: (buffer) => Buffer.from(buffer).toString('utf8')
			},
			BrowserWindow: class {},
			ipcMain: { on: () => {}, handle: () => {} }
		};
	}
	return load.apply(this, arguments);
};

const RISK_MESSAGE = 'rate limited (风控要求验证: type=verify subtype=semantic_reasoning) [logid=202610110160335F77A3260120557AA1C95]';

const counters = { risk: 0, ok: 0 };
function startServer(kind) {
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', () => {
				if (kind === 'risk') {
					counters.risk += 1;
					res.writeHead(429, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: { message: RISK_MESSAGE } }));
					return;
				}
				counters.ok += 1;
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(
					JSON.stringify({
						choices: [{ message: { role: 'assistant', content: JSON.stringify({ answer: '东方的直布罗陀' }) } }]
					})
				);
			});
		});
		server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
	});
}

const checks = [];
function check(name, ok, detail) {
	checks.push({ name, ok: Boolean(ok), detail });
}

function provider(id, name, model, port, enabled = true) {
	return { id, name, protocol: 'openai-chat', baseUrl: `http://127.0.0.1:${port}/v1`, model, enabled };
}

async function main() {
	const risk = await startServer('risk');
	const ok = await startServer('ok');
	const qb = require(questionBankPath);
	const resilience = require(resiliencePath);
	const { chatDoubao } = require(doubaoPath);

	check('classifyFailure 识别用户截图里的风控原文', resilience.classifyFailure(RISK_MESSAGE) === 'risk', resilience.classifyFailure(RISK_MESSAGE));

	qb.saveQuestionBankConfig({
		providers: [
			provider('builtin-doubao', '内置豆包', 'doubao-fast', 9, false),
			provider('builtin-workbuddy', '内置 WorkBuddy / CodeBuddy', 'cn:glm-5.3-flash', 9, false),
			provider('mock-risk', '风控模型', 'risk-model', risk.port),
			provider('mock-ok', '备用模型', 'ok-model', ok.port)
		],
		selectedProviderId: 'mock-risk'
	});

	const first = await qb.queryQuestionBank({
		title: '甲午海战期间，由60余座炮台和要塞构成的（）防御体系地势险要，堪称“东方的直布罗陀”。',
		options: 'A. 旅顺口 B. 威海卫 C. 大连湾 D. 蓬莱',
		type: '单选题'
	});
	check('命中风控后仍能答出题', first.answer === '东方的直布罗陀', first.answer);
	const firstInfo = first.diagnostics || first;
	check('答案来源记录为备用模型', firstInfo.provider && firstInfo.provider.id === 'mock-ok', JSON.stringify(firstInfo));
	check(
		'说明本题发生了降级',
		Array.isArray(firstInfo.fallbackFrom) && firstInfo.fallbackFrom.some((item) => item.id === 'mock-risk' && item.kind === 'risk'),
		JSON.stringify(firstInfo.fallbackFrom)
	);
	check('风控模型只被请求一次', counters.risk === 1, counters.risk);
	check('风控模型进入冷却', Boolean(resilience.providerCooldown('mock-risk')), JSON.stringify(resilience.providerCooldown('mock-risk')));

	const second = await qb.queryQuestionBank({ title: '第二题：冷却期内不应再打风控模型', options: 'A. 甲 B. 乙', type: '单选题' });
	check('冷却期内不再请求风控模型', counters.risk === 1, counters.risk);
	const secondInfo = second.diagnostics || second;
	check('第二题仍由备用模型作答', second.answer === '东方的直布罗陀' && secondInfo.provider && secondInfo.provider.id === 'mock-ok', JSON.stringify(secondInfo.provider));

	// 全部模型都风控：换成两个风控上游，且先清掉冷却。
	const risk2 = await startServer('risk');
	resilience.clearProviderCooldown('mock-risk');
	resilience.clearProviderCooldown('mock-ok');
	qb.saveQuestionBankConfig({
		providers: [
			provider('builtin-doubao', '内置豆包', 'doubao-fast', 9, false),
			provider('builtin-workbuddy', '内置 WorkBuddy / CodeBuddy', 'cn:glm-5.3-flash', 9, false),
			provider('mock-risk', '风控模型', 'risk-model', risk.port),
			provider('mock-ok', '备用模型', 'ok-model', risk2.port)
		],
		selectedProviderId: 'mock-risk'
	});
	let allFailed = '';
	try {
		await qb.queryQuestionBank({ title: '第三题：两个模型都被风控', options: 'A. 甲 B. 乙', type: '单选题' });
	} catch (error) {
		allFailed = String(error && error.message);
	}
	check('全部风控时给出可操作提示', /风控/.test(allFailed) && /模型接入/.test(allFailed), allFailed.slice(0, 160));
	check('全部风控时不再直接抛上游原文', allFailed !== RISK_MESSAGE, allFailed.slice(0, 80));

	// 内置豆包冷却守卫：不压网关，直接快速失败。
	resilience.coolProvider('builtin-doubao', 'risk', 'type=verify');
	let doubaoError = '';
	try {
		await chatDoubao({ prompt: '测试' });
	} catch (error) {
		doubaoError = String(error && error.message);
	}
	check('豆包冷却时直接快速失败', /冷却/.test(doubaoError), doubaoError.slice(0, 120));

	risk.server.close();
	risk2.server.close();
	ok.server.close();

	const failed = checks.filter((item) => !item.ok);
	console.log(JSON.stringify({ total: checks.length, failed: failed.length, checks }, null, 1));
	process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
	console.error('FATAL', error);
	process.exit(1);
});
