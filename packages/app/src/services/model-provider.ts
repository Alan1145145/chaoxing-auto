import axios from 'axios';
import type { QuestionBankProtocol, QuestionBankProvider } from './question-bank';

export interface QuestionBankModel {
	id: string;
	name: string;
}

export function validateProviderAddress(provider: QuestionBankProvider) {
	if (!['openai-chat', 'anthropic', 'gemini'].includes(provider.protocol)) {
		throw new Error('不支持的模型接口协议。');
	}
	let url: URL;
	try {
		url = new URL(String(provider.baseUrl || '').trim());
	} catch {
		throw new Error('模型服务地址格式无效。');
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
		throw new Error('模型服务地址仅支持不含账号、查询参数或片段的 HTTP(S) 地址。');
	}
	return url;
}

/** 保留服务商的自定义前缀；只有根地址才补默认 API 版本。 */
export function apiBase(provider: QuestionBankProvider) {
	const url = validateProviderAddress(provider);
	const basePath = url.pathname.replace(/\/+$/, '');
	const endpoint =
		provider.protocol === 'openai-chat'
			? /\/(?:chat\/completions|responses|models)$/i
			: provider.protocol === 'anthropic'
			? /\/(?:messages|models)$/i
			: /\/models(?:\/[^/]+(?::generateContent)?)?$/i;
	const path = basePath.replace(endpoint, '');
	const version = provider.protocol === 'gemini' ? '/v1beta' : '/v1';
	return `${url.origin}${path || (endpoint.test(basePath) ? '' : version)}`;
}

export function modelEndpoint(provider: QuestionBankProvider) {
	const base = apiBase(provider);
	if (provider.protocol === 'openai-chat') return `${base}/chat/completions`;
	if (provider.protocol === 'anthropic') return `${base}/messages`;
	return `${base}/models/${encodeURIComponent(provider.model.replace(/^models\//, ''))}:generateContent`;
}

export function modelHeaders(provider: QuestionBankProvider): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (provider.protocol === 'anthropic') {
		headers['anthropic-version'] = '2023-06-01';
		if (provider.apiKey) headers['x-api-key'] = provider.apiKey;
	} else if (provider.apiKey) {
		if (provider.protocol === 'gemini') headers['x-goog-api-key'] = provider.apiKey;
		else headers.Authorization = `Bearer ${provider.apiKey}`;
	}
	return headers;
}

export function modelRequestError(error: any, apiKey: string, action = '模型请求失败') {
	const body = error?.response?.data;
	const detail =
		body?.error?.message ||
		body?.message ||
		(typeof body === 'string' ? body : '') ||
		(error?.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : error?.message) ||
		'未知错误';
	let message = String(detail);
	if (apiKey) {
		for (const secret of new Set([apiKey, encodeURIComponent(apiKey)])) {
			message = message.split(secret).join('[已隐藏]');
		}
	}
	message = message.replace(/([?&]key=)[^&\s]*/gi, '$1[已隐藏]').slice(0, 500);
	const status = error?.response?.status;
	return new Error(`${action}${status ? `（HTTP ${status}）` : ''}：${message}`);
}

function modelFrom(item: any, protocol: QuestionBankProtocol): QuestionBankModel | null {
	if (
		protocol === 'gemini' &&
		Array.isArray(item?.supportedGenerationMethods) &&
		!item.supportedGenerationMethods.includes('generateContent')
	)
		return null;
	const value = typeof item === 'string' ? item : item?.id || item?.name;
	if (typeof value !== 'string' || !value.trim()) return null;
	const id = protocol === 'gemini' ? value.trim().replace(/^models\//, '') : value.trim();
	return { id, name: String(item?.display_name || item?.displayName || id) };
}

export async function listProviderModels(provider: QuestionBankProvider): Promise<QuestionBankModel[]> {
	const endpoint = `${apiBase(provider)}/models`;
	const models = new Map<string, QuestionBankModel>();
	const cursors = new Set<string>();
	const deadline = Date.now() + 60000;
	let cursor = '';
	for (let page = 0; page < 20; page++) {
		const params: Record<string, string | number> = {};
		if (provider.protocol === 'anthropic') {
			params.limit = 1000;
			if (cursor) params.after_id = cursor;
		} else if (provider.protocol === 'gemini') {
			params.pageSize = 1000;
			if (cursor) params.pageToken = cursor;
		}
		const remaining = deadline - Date.now();
		if (remaining <= 0) throw new Error('获取模型超时，请稍后重试。');
		let data: any;
		try {
			({ data } = await axios.get(endpoint, {
				headers: modelHeaders(provider),
				params,
				timeout: Math.min(15000, remaining)
			}));
		} catch (error: any) {
			const failure = modelRequestError(error, provider.apiKey || '', '获取模型失败');
			if ([404, 405].includes(error?.response?.status)) {
				throw new Error(`${failure.message}。请检查服务地址；服务商不支持模型列表时可手动填写模型 ID。`);
			}
			throw failure;
		}
		const items = Array.isArray(data) ? data : provider.protocol === 'gemini' ? data?.models : data?.data;
		if (!Array.isArray(items)) throw new Error('服务未返回有效的模型列表，请检查服务地址和接口协议。');
		for (const item of items) {
			const model = modelFrom(item, provider.protocol);
			if (model) models.set(model.id, model);
		}
		cursor =
			provider.protocol === 'gemini'
				? data?.nextPageToken || ''
				: provider.protocol === 'anthropic' && data?.has_more
				? data?.last_id || ''
				: '';
		if (provider.protocol === 'anthropic' && data?.has_more && !cursor) {
			throw new Error('模型列表缺少分页标识，请手动填写模型 ID。');
		}
		if (!cursor) {
			if (!models.size) throw new Error('该接口未返回可用的对话模型，请确认 API Key 的权限，或手动填写模型 ID。');
			return Array.from(models.values());
		}
		if (cursors.has(cursor)) throw new Error('模型列表分页重复，请手动填写模型 ID。');
		cursors.add(cursor);
	}
	throw new Error('模型列表分页过多，请手动填写模型 ID。');
}
