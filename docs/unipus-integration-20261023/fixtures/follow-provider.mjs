/**
 * U校园 助手 · 「模型接入」跟随夹具
 *
 * 验证桌面端 `describeSelectedProvider()`（`packages/app/src/services/question-bank.ts`）
 * 真的把「模型接入」的选择摘要出来——U校园 助手就是靠这个字段决定
 * 走豆包直连还是走桌面端转发，形状错了助手会静默选错链路。
 *
 * 做法：stub 掉 `electron`（app / safeStorage）与临时 userData 目录，
 * 直接 require 编译产物 `packages/app/lib/src/services/question-bank.js`，
 * 覆盖「首次安装只有内置豆包」与「选了自定义 OpenAI 兼容模型」两种状态。
 *
 * 运行：
 *   node docs/unipus-integration-20261023/fixtures/follow-provider.mjs
 * 前置：已执行过 `npx tsc -p tsconfig.json`（packages/app）。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../../../packages/app');
const questionBankPath = path.join(appRoot, 'lib/src/services/question-bank.js');

if (!fs.existsSync(questionBankPath)) {
	throw new Error('缺少编译产物，请先执行：cd packages/app && npx tsc -p tsconfig.json');
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-qb-'));
const load = require('module')._load;
require('module')._load = function (request) {
	if (request === 'electron') {
		return {
			app: { getPath: () => userData, getVersion: () => '1.0.5', isPackaged: false, on: () => {} },
			safeStorage: {
				isEncryptionAvailable: () => true,
				// 仅测试桩：base64 当「加密」，同进程内可逆即可，不涉及真实凭据
				encryptString: (text) => Buffer.from(String(text), 'utf8'),
				decryptString: (buffer) => Buffer.from(buffer).toString('utf8')
			}
		};
	}
	return load.apply(this, arguments);
};

const qb = require(questionBankPath);

const fresh = qb.describeSelectedProvider();
const saved = qb.saveQuestionBankConfig({
	providers: [
		{
			id: 'self-hosted',
			name: '自建 OpenAI 兼容',
			protocol: 'openai-chat',
			baseUrl: 'https://example.invalid/v1',
			model: 'gpt-4o-mini',
			apiKey: '',
			enabled: true
		}
	],
	selectedProviderId: 'self-hosted',
	autoSaveAiAnswers: true
});
const custom = qb.describeSelectedProvider();
const config = qb.getQuestionBankConfig();

const checks = [
	['默认选中内置豆包', fresh && fresh.id === 'builtin-doubao' && fresh.builtinDoubao === true],
	['默认模型 doubao-fast', fresh && fresh.model === 'doubao-fast'],
	['保存后 selectedProviderId 生效', saved.selectedProviderId === 'self-hosted'],
	['自定义模型 builtinDoubao=false', custom && custom.id === 'self-hosted' && custom.builtinDoubao === false],
	['自定义模型名与 ID 正确', custom && custom.name === '自建 OpenAI 兼容' && custom.model === 'gpt-4o-mini'],
	['摘要不含 apiKey', !Object.prototype.hasOwnProperty.call(custom || {}, 'apiKey')],
	['配置里保留内置豆包备用', config.providers.some((provider) => provider.id === 'builtin-doubao')]
];

let failed = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
	if (!ok) failed++;
}
console.log(JSON.stringify({ fresh, custom }, null, 2));

fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
