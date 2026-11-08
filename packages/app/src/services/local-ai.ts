import { randomUUID } from 'crypto';
import { chatWithSelectedProvider, describeSelectedProvider } from './question-bank';
import {
	DOUBAO_MAX_PROMPT_LENGTH,
	DOUBAO_MODELS,
	DOUBAO_PROVIDER_ID,
	chatDoubao,
	getDoubaoStatus,
	peekDoubaoStatus
} from './doubao';
import { isEmbeddedStorageTokenValid } from '../utils/embedded-storage';

export type LocalAiChatResult = { status: number; body: Record<string, unknown> };

const MAX_PROMPT_LENGTH = 200000;

function extractPrompt(body: any) {
	const messages = Array.isArray(body?.messages) ? body.messages : [];
	return messages
		.map((message: any) => {
			if (!message || message.role === 'system') return '';
			if (typeof message.content === 'string') return message.content;
			if (Array.isArray(message.content)) {
				return message.content.map((part: any) => (typeof part?.text === 'string' ? part.text : '')).join('\n');
			}
			return '';
		})
		.filter(Boolean)
		.join('\n\n')
		.trim();
}

export function isLoopbackAddress(address: string | undefined) {
	const value = String(address || '').toLowerCase();
	return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

/** 内嵌脚本与本机脚本管理器共用同一套令牌规则。 */
function isAuthorized(input: { authorization?: string; remoteAddress?: string }) {
	const token = String(input.authorization || '')
		.replace(/^Bearer\s+/i, '')
		.trim();
	return isEmbeddedStorageTokenValid(token) || isLoopbackAddress(input.remoteAddress);
}

function openAiBody(content: string, model: string, extra?: Record<string, unknown>) {
	return {
		id: `local-${randomUUID()}`,
		object: 'chat.completion',
		model,
		choices: [
			{
				index: 0,
				message: { role: 'assistant', content },
				finish_reason: 'stop'
			}
		],
		usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
		...extra
	};
}

/**
 * 本地 OpenAI 兼容接口：内嵌脚本（U校园刷课助手）通过桌面端「模型接入」答题。
 * 令牌与内嵌 GM 存储桥一致；外部 Chrome 的脚本管理器无法注入令牌，
 * 因此本机回环地址（127.0.0.1/::1）允许无令牌访问，与已有的 /query 题库接口保持一致。
 */
export async function handleLocalAiChat(input: {
	authorization?: string;
	remoteAddress?: string;
	body?: any;
}): Promise<LocalAiChatResult> {
	if (!isAuthorized(input)) {
		return { status: 401, body: { error: { message: '本地模型接口令牌无效，请在桌面端内嵌浏览器中使用。' } } };
	}
	const prompt = extractPrompt(input.body);
	if (!prompt) {
		return { status: 400, body: { error: { message: '请求内容不能为空。' } } };
	}
	if (prompt.length > MAX_PROMPT_LENGTH) {
		return { status: 400, body: { error: { message: '请求内容过长。' } } };
	}
	try {
		const result = await chatWithSelectedProvider(prompt, { maxTokens: input.body?.max_tokens });
		return { status: 200, body: openAiBody(result.content, result.provider.model || input.body?.model || 'local') };
	} catch (error) {
		return {
			status: 502,
			body: { error: { message: error instanceof Error ? error.message : String(error), code: 'local_ai_error' } }
		};
	}
}

/**
 * 直接调用内置豆包网关。
 *
 * 与 `/v1/chat/completions` 的区别是绕过「模型接入」的 provider 选择：
 * 即使使用者没有配置任何外部模型，U校园 助手也能用软件自带的豆包答题。
 * 豆包单次只接受 3 万字，超长题目由脚本退回 `ocs_local`。
 */
export async function handleLocalAiDoubao(input: {
	authorization?: string;
	remoteAddress?: string;
	body?: any;
}): Promise<LocalAiChatResult> {
	if (!isAuthorized(input)) {
		return { status: 401, body: { error: { message: '本地模型接口令牌无效，请在桌面端内嵌浏览器中使用。' } } };
	}
	const prompt = extractPrompt(input.body);
	if (!prompt) {
		return { status: 400, body: { error: { message: '请求内容不能为空。', code: 'empty_prompt' } } };
	}
	if (prompt.length > DOUBAO_MAX_PROMPT_LENGTH) {
		return {
			status: 413,
			body: {
				error: {
					message: `内容超过豆包单次 ${DOUBAO_MAX_PROMPT_LENGTH} 字上限，请改用「模型接入」链路。`,
					code: 'prompt_too_long',
					fallback: 'ocs_local'
				}
			}
		};
	}
	const requested = String(input.body?.model || '').trim();
	const model = DOUBAO_MODELS.includes(requested) ? requested : undefined;
	try {
		const result = await chatDoubao({ prompt, model });
		return { status: 200, body: openAiBody(result.content, model || 'doubao-fast', { provider: DOUBAO_PROVIDER_ID }) };
	} catch (error) {
		return {
			status: 502,
			body: {
				error: {
					message: error instanceof Error ? error.message : String(error),
					code: 'doubao_error',
					fallback: 'ocs_local'
				}
			}
		};
	}
}

/** 健康探测：脚本据此判断桌面端在线、软件端选中的模型、豆包是否已登录，以及应使用哪条链路。 */
export async function buildLocalAiHealth(input: { version: string; probeDoubao?: boolean }) {
	const doubao = input.probeDoubao ? await probeDoubaoStatus() : peekDoubaoStatus();
	return {
		ok: true,
		app: 'ocs-desktop',
		version: input.version,
		localAi: {
			maxPromptLength: MAX_PROMPT_LENGTH,
			endpoint: '/api/local-ai/v1/chat/completions',
			// 助手默认跟随这里：软件端「模型接入」选的是谁，就自动用谁（默认内置豆包）。
			selected: describeSelectedProvider()
		},
		doubao: {
			providerId: DOUBAO_PROVIDER_ID,
			running: doubao.running,
			loggedIn: doubao.loggedIn,
			models: doubao.models,
			maxPromptLength: DOUBAO_MAX_PROMPT_LENGTH,
			endpoint: '/api/local-ai/doubao',
			error: doubao.loginError || ''
		}
	};
}

/**
 * 主动探测豆包状态：会拉起网关子进程，因此只在脚本明确请求（`?doubao=1`）时使用。
 * 结果缓存 60 秒，避免每个学习页加载都尝试拉起网关（例如被杀毒软件拦截时）。
 * 探测失败不抛错，否则健康接口会把「豆包不可用」变成「桌面端不可用」。
 */
let doubaoProbe: { at: number; value: Awaited<ReturnType<typeof peekDoubaoStatus>> & { error: string } } | null = null;

async function probeDoubaoStatus() {
	if (doubaoProbe && Date.now() - doubaoProbe.at < 60000) return doubaoProbe.value;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let value: Awaited<ReturnType<typeof peekDoubaoStatus>> & { error: string };
	try {
		const timeout = new Promise<{ timedOut: true }>((resolve) => {
			timer = setTimeout(() => resolve({ timedOut: true }), 8000);
		});
		const result = await Promise.race([
			getDoubaoStatus().then((status) => ({ timedOut: false as const, status })),
			timeout
		]);
		if (result.timedOut) throw new Error('豆包状态探测超时。');
		value = { ...result.status, error: '' };
	} catch (error) {
		value = { ...peekDoubaoStatus(), error: error instanceof Error ? error.message : String(error) };
	} finally {
		if (timer) clearTimeout(timer);
	}
	doubaoProbe = { at: Date.now(), value };
	return value;
}
