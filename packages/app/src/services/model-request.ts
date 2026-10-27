import axios from 'axios';
import type { QuestionBankProvider, QuestionBankProtocol } from './question-bank';
import { DOUBAO_PROVIDER_ID, chatDoubao } from './doubao';
import { apiBase, modelEndpoint, modelHeaders, modelRequestError } from './model-provider';
import { capabilityPreset, thinkingParameters } from './model-capabilities';
import { searchContext } from './model-search';

function imageParts(images: string[]) {
	return images
		.map((image) => {
			const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
			return match ? { mediaType: match[1], data: match[2], url: image } : null;
		})
		.filter((image): image is { mediaType: string; data: string; url: string } => image !== null);
}

function contentWithImages(prompt: string, images: ReturnType<typeof imageParts>, protocol: QuestionBankProtocol) {
	if (protocol === 'openai-chat') {
		return [
			{ type: 'text', text: prompt },
			...images.map((image) => ({ type: 'image_url', image_url: { url: image.url } }))
		];
	}
	if (protocol === 'anthropic') {
		return [
			{ type: 'text', text: prompt },
			...images.map((image) => ({
				type: 'image',
				source: { type: 'base64', media_type: image.mediaType, data: image.data }
			}))
		];
	}
	return [
		{ text: prompt },
		...images.map((image) => ({ inlineData: { mimeType: image.mediaType, data: image.data } }))
	];
}

function readOpenAIStream(payload: string) {
	const pieces: string[] = [];
	for (const line of payload.split(/\r?\n/)) {
		const text = line.trim();
		if (!text.startsWith('data:')) continue;
		const data = text.slice(5).trim();
		if (!data || data === '[DONE]') continue;
		try {
			const event = JSON.parse(data);
			const delta = event?.choices?.[0]?.delta?.content ?? event?.choices?.[0]?.message?.content;
			const chunk = responseText(delta);
			if (chunk) pieces.push(chunk);
		} catch {
			// 忽略无法解析的流片段。
		}
	}
	return pieces.join('');
}

function responseText(value: any): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map((item) => (typeof item?.text === 'string' ? item.text : '')).join('\n');
	return '';
}

export async function callProvider(
	provider: QuestionBankProvider,
	prompt: string,
	images: string[],
	maxTokens = 800,
	searchQuery = prompt
): Promise<string> {
	const preset = capabilityPreset(provider);
	const nativeSearch = provider.protocol !== 'openai-chat' || preset === 'qwen' || preset === 'openai';
	if (provider.webSearchEnabled && (!nativeSearch || provider.id === DOUBAO_PROVIDER_ID)) prompt += await searchContext(searchQuery);
	if (provider.id === DOUBAO_PROVIDER_ID) {
		if (images.length) throw new Error('当前内置豆包网关支持文本题目；图片题请先识别文字或选择支持图片的模型。');
		return (await chatDoubao({ prompt, model: provider.reasoningEnabled ? 'doubao-expert' : provider.model })).content;
	}
	const parts = imageParts(images);
	const endpoint = modelEndpoint(provider);
	const headers = modelHeaders(provider);
	const timeout = 120000;
	const thinking = thinkingParameters(provider);
	const tokenBudget = provider.reasoningEnabled ? Math.max(16384, maxTokens) : maxTokens;
	try {
		if (provider.protocol === 'openai-chat') {
			if (provider.webSearchEnabled && preset === 'openai') {
				const { data } = await axios.post(`${apiBase(provider)}/responses`, {
					model: provider.model,
					input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, ...parts.map((image) => ({ type: 'input_image', image_url: image.url }))] }],
					tools: [{ type: 'web_search' }], tool_choice: 'required',
					...(provider.reasoningEnabled ? { reasoning: { effort: 'high' } } : {})
				}, { headers, timeout });
				if (data?.error || data?.status === 'incomplete') throw new Error(data?.error?.message || '联网模型未完成回答，请重试。');
				return (data?.output || []).filter((item: any) => item.type === 'message').map((item: any) => responseText(item.content)).join('\n');
			}
			const userContent = parts.length ? contentWithImages(prompt, parts, provider.protocol) : prompt;
			const messages = [{ role: 'user', content: userContent }];
			const postChat = (body: Record<string, unknown>, responseType: 'json' | 'text' = 'json') =>
				axios.post(endpoint, body, { headers, timeout, responseType });
			try {
				const { data } = await postChat({
					model: provider.model,
					messages,
					stream: false,
					...thinking,
					...(provider.webSearchEnabled && preset === 'qwen' ? { enable_search: true, search_options: { forced_search: true } } : {})
				});
				if (typeof data === 'string' && data.trimStart().startsWith('data:')) return readOpenAIStream(data);
				return responseText(data?.choices?.[0]?.message?.content);
			} catch (error: any) {
				if (error?.response?.status !== 400 || !/stream/i.test(JSON.stringify(error?.response?.data))) throw error;
				const { data } = await postChat({ model: provider.model, messages, stream: true, ...thinking,
					...(provider.webSearchEnabled && preset === 'qwen' ? { enable_search: true, search_options: { forced_search: true } } : {}) }, 'text');
				return readOpenAIStream(String(data || ''));
			}
		}
		if (provider.protocol === 'anthropic') {
			const { data } = await axios.post(
				endpoint,
				{
					model: provider.model,
					max_tokens: tokenBudget,
					...thinking,
					...(provider.webSearchEnabled ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}),
					system: '请遵守用户给出的题型规则，只返回 JSON 答案。',
					messages: [{ role: 'user', content: contentWithImages(prompt, parts, provider.protocol) }]
				},
				{
					headers,
					timeout
				}
			);
			if (data?.content?.some((item: any) => item.type === 'web_search_tool_result' && item.content?.type === 'web_search_tool_result_error')) throw new Error('服务商联网搜索失败，请检查模型权限。');
			return responseText(data?.content?.filter((item: any) => item.type === 'text'));
		}
		const { data } = await axios.post(
			endpoint,
			{
				contents: [{ role: 'user', parts: contentWithImages(prompt, parts, provider.protocol) }],
				generationConfig: { ...(provider.reasoningEnabled ? thinking : { temperature: 0.1 }), maxOutputTokens: tokenBudget },
				...(provider.webSearchEnabled ? { tools: [{ google_search: {} }] } : {})
			},
			{ headers, timeout }
		);
		return responseText(data?.candidates?.[0]?.content?.parts?.filter((item: any) => !item.thought));
	} catch (error: any) {
		throw modelRequestError(error, provider.apiKey || '');
	}
}

