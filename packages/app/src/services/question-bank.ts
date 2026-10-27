import { app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { decryptRenderString, encryptRenderString } from '../crypto';
import { DOUBAO_PROVIDER_ID } from './doubao';
import { listProviderModels, validateProviderAddress } from './model-provider';

import { callProvider } from './model-request';
import type { CapabilityPreset } from './model-capabilities';

export type QuestionBankProtocol = 'openai-chat' | 'anthropic' | 'gemini';
export type QuestionBankSource = 'manual' | 'import' | 'ai';

export interface QuestionBankProvider {
	id: string;
	name: string;
	protocol: QuestionBankProtocol;
	baseUrl: string;
	model: string;
	apiKey?: string;
	enabled: boolean;
	hasApiKey?: boolean;
	clearApiKey?: boolean;
	reasoningEnabled?: boolean;
	webSearchEnabled?: boolean;
	capabilityPreset?: CapabilityPreset;
}

export interface QuestionBankSettings {
	providers: QuestionBankProvider[];
	selectedProviderId: string | null;
	autoSaveAiAnswers: boolean;
}

export interface QuestionBankQuestion {
	id: string;
	title: string;
	options: string;
	answer: string;
	type: string;
	explanation: string;
	source: QuestionBankSource;
	verified: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface QuestionBankPage {
	items: QuestionBankQuestion[];
	total: number;
	page: number;
	pageSize: number;
}

const DEFAULT_SETTINGS: QuestionBankSettings = {
	providers: [],
	selectedProviderId: null,
	autoSaveAiAnswers: true
};

function dataDirectory() {
	return path.join(app.getPath('userData'), 'question-bank');
}

function settingsPath() {
	return path.join(dataDirectory(), 'settings.enc');
}

function questionsPath() {
	return path.join(dataDirectory(), 'questions.json');
}

function ensureDirectory() {
	fs.mkdirSync(dataDirectory(), { recursive: true });
}

function writeAtomic(filePath: string, content: string) {
	ensureDirectory();
	const tempPath = `${filePath}.${process.pid}.tmp`;
	fs.writeFileSync(tempPath, content, 'utf8');
	fs.renameSync(tempPath, filePath);
}

function normalizePreset(value: unknown): CapabilityPreset {
	return ['openai', 'qwen', 'deepseek', 'compatible'].includes(String(value)) ? value as CapabilityPreset : 'auto';
}

function normalizeSettings(value: any): QuestionBankSettings {
	const providers = Array.isArray(value?.providers)
		? value.providers
				.filter((provider: any) => provider && typeof provider.id === 'string')
				.map((provider: any) => ({
					id: provider.id,
					name: String(provider.name || '').trim(),
					protocol: provider.protocol as QuestionBankProtocol,
					baseUrl: String(provider.baseUrl || '').trim(),
					model: String(provider.model || '').trim(),
					apiKey: String(provider.apiKey || ''),
					reasoningEnabled: provider.reasoningEnabled === true,
					webSearchEnabled: provider.webSearchEnabled === true,
					capabilityPreset: normalizePreset(provider.capabilityPreset),
					enabled: provider.enabled !== false
				}))
		: [];
	const selectedProviderId = providers.some(
		(provider: QuestionBankProvider) => provider.id === value?.selectedProviderId
	)
		? value.selectedProviderId
		: providers.find((provider: QuestionBankProvider) => provider.enabled)?.id || null;

	return {
		providers,
		selectedProviderId,
		autoSaveAiAnswers: value?.autoSaveAiAnswers !== false
	};
}

function readSettings(): QuestionBankSettings {
	const filePath = settingsPath();
	if (!fs.existsSync(filePath)) return withDoubao({ ...DEFAULT_SETTINGS });
	try {
		return withDoubao(normalizeSettings(JSON.parse(decryptRenderString(fs.readFileSync(filePath, 'utf8')))));
	} catch (error) {
		throw new Error(`题库模型配置读取失败：${error instanceof Error ? error.message : String(error)}`);
	}
}

function withDoubao(settings: QuestionBankSettings): QuestionBankSettings {
	if (!settings.providers.some((provider) => provider.id === DOUBAO_PROVIDER_ID)) {
		settings.providers.unshift({ id: DOUBAO_PROVIDER_ID, name: '内置豆包', protocol: 'openai-chat',
			baseUrl: 'http://127.0.0.1', model: 'doubao-fast', enabled: true });
	}
	if (!settings.selectedProviderId) settings.selectedProviderId = DOUBAO_PROVIDER_ID;
	return settings;
}

function readQuestions(): QuestionBankQuestion[] {
	const filePath = questionsPath();
	if (!fs.existsSync(filePath)) return [];
	const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	if (!Array.isArray(data)) throw new Error('本地题库文件格式无效。');
	return data.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string');
}

function writeQuestions(questions: QuestionBankQuestion[]) {
	writeAtomic(questionsPath(), JSON.stringify(questions, null, 2));
}

function publicSettings(settings: QuestionBankSettings): QuestionBankSettings {
	return {
		...settings,
		providers: settings.providers.map((provider) => ({
			...provider,
			hasApiKey: Boolean(provider.apiKey),
			apiKey: ''
		}))
	};
}

export function getQuestionBankConfig(): QuestionBankSettings {
	return publicSettings(readSettings());
}

export function saveQuestionBankConfig(input: QuestionBankSettings): QuestionBankSettings {
	const current = readSettings();
	const currentById = new Map(current.providers.map((provider) => [provider.id, provider]));
	const providers = (Array.isArray(input?.providers) ? input.providers : []).map((provider) => {
		const name = String(provider.name || '').trim();
		const model = String(provider.model || '').trim();
		const baseUrl = String(provider.baseUrl || '').trim();
		if (!provider.id || !name || !model || !baseUrl) {
			throw new Error('模型名称、服务地址和模型 ID 均不能为空。');
		}
		validateProviderAddress({ ...provider, baseUrl });
		const previous = currentById.get(provider.id);
		return {
			id: provider.id,
			name,
			model,
			baseUrl: baseUrl.replace(/\/+$/, ''),
			protocol: provider.protocol,
			reasoningEnabled: provider.reasoningEnabled === true,
			webSearchEnabled: provider.webSearchEnabled === true,
			capabilityPreset: normalizePreset(provider.capabilityPreset),
			enabled: provider.enabled !== false,
			apiKey: provider.clearApiKey ? '' : String(provider.apiKey || '').trim() || previous?.apiKey || ''
		} as QuestionBankProvider;
	});
	if (providers.length > 30) throw new Error('最多可配置 30 个模型接入。');
	const selectedProviderId = providers.some((provider) => provider.id === input.selectedProviderId && provider.enabled)
		? input.selectedProviderId
		: providers.find((provider) => provider.enabled)?.id || null;
	const settings: QuestionBankSettings = withDoubao({
		providers,
		selectedProviderId,
		autoSaveAiAnswers: input.autoSaveAiAnswers !== false
	});
	writeAtomic(settingsPath(), encryptRenderString(JSON.stringify(settings)));
	return publicSettings(settings);
}

function normalizeText(value: string) {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;|&#160;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/[\s\p{P}\p{S}]+/gu, '');
}

function questionKey(question: Pick<QuestionBankQuestion, 'title' | 'options'>) {
	return `${normalizeText(question.title)}\u0000${normalizeText(question.options || '')}`;
}

export function listQuestionBankQuestions(input?: {
	query?: string;
	page?: number;
	pageSize?: number;
}): QuestionBankPage {
	const all = readQuestions();
	const query = normalizeText(String(input?.query || ''));
	const filtered = query
		? all.filter((question) =>
				normalizeText(`${question.title} ${question.options} ${question.answer}`).includes(query)
		  )
		: all;
	filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	const pageSize = Math.max(1, Math.min(200, Math.floor(Number(input?.pageSize) || 20)));
	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
	const page = Math.max(1, Math.min(pageCount, Math.floor(Number(input?.page) || 1)));
	return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
}

function normalizeQuestionInput(
	input: Partial<QuestionBankQuestion>,
	existing?: QuestionBankQuestion
): QuestionBankQuestion {
	const title = String(input.title || '').trim();
	const answer = String(input.answer || '').trim();
	if (!title || !answer) throw new Error('题目和答案不能为空。');
	if (title.length > 20000 || answer.length > 10000) throw new Error('题目或答案内容过长。');
	if (String(input.options || '').length > 50000 || String(input.explanation || '').length > 50000) {
		throw new Error('选项或解析内容过长。');
	}
	const now = new Date().toISOString();
	const source: QuestionBankSource = ['manual', 'import', 'ai'].includes(String(input.source))
		? (input.source as QuestionBankSource)
		: 'manual';
	return {
		id: existing?.id || String(input.id || crypto.randomUUID()),
		title,
		options: String(input.options || '').trim(),
		answer,
		type: String(input.type || '').trim(),
		explanation: String(input.explanation || '').trim(),
		source,
		verified: input.verified === true,
		createdAt: existing?.createdAt || String(input.createdAt || now),
		updatedAt: now
	};
}

export function saveQuestionBankQuestion(input: Partial<QuestionBankQuestion>): QuestionBankQuestion {
	const questions = readQuestions();
	const index = input.id
		? questions.findIndex((question) => question.id === input.id)
		: input.source === 'ai'
		? questions.findIndex(
				(question) =>
					question.source === 'ai' &&
					!question.verified &&
					questionKey(question) ===
						questionKey({ title: String(input.title || '').trim(), options: String(input.options || '').trim() })
		  )
		: -1;
	const existing = index >= 0 ? questions[index] : undefined;
	const question = normalizeQuestionInput(input, existing);
	if (index >= 0) questions[index] = question;
	else questions.unshift(question);
	writeQuestions(questions);
	return question;
}

export function deleteQuestionBankQuestion(id: string): boolean {
	const questions = readQuestions();
	const next = questions.filter((question) => question.id !== id);
	if (next.length === questions.length) return false;
	writeQuestions(next);
	return true;
}

export function importQuestionBankQuestions(items: Partial<QuestionBankQuestion>[]) {
	if (!Array.isArray(items)) throw new Error('导入数据必须是题目数组。');
	if (items.length > 50000) throw new Error('单次最多导入 50,000 道题目。');
	const questions = readQuestions();
	const indexByKey = new Map(questions.map((question, index) => [questionKey(question), index]));
	let added = 0;
	let updated = 0;
	let skipped = 0;
	for (const item of items) {
		try {
			const next = normalizeQuestionInput({ ...item, source: item.source === 'ai' ? 'ai' : 'import' });
			const key = questionKey(next);
			const index = indexByKey.get(key);
			if (index === undefined) {
				indexByKey.set(key, questions.length);
				questions.push(next);
				added++;
			} else {
				const current = questions[index];
				questions[index] = { ...next, id: current.id, createdAt: current.createdAt };
				updated++;
			}
		} catch {
			skipped++;
		}
	}
	writeQuestions(questions);
	return { added, updated, skipped, total: questions.length };
}

export function exportQuestionBankQuestions(): QuestionBankQuestion[] {
	return readQuestions();
}

export function getQuestionBankStatus() {
	const settings = readSettings();
	const provider = settings.providers.find((item) => item.id === settings.selectedProviderId && item.enabled);
	return { status: 'ready', questionCount: readQuestions().length, modelConfigured: Boolean(provider?.model) };
}

function parseImages(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').slice(0, 12);
	if (typeof value !== 'string' || !value.trim()) return [];
	try {
		return parseImages(JSON.parse(value));
	} catch {
		return [];
	}
}

function buildPrompt(title: string, options: string, type: string) {
	const kind = type.toLowerCase();
	let answerRule = '答案只写正确答案文本，不要写推理过程。';
	if (kind.includes('single') || kind.includes('单选'))
		answerRule = '这是单选题，只返回一个正确选项的完整文字，不要返回选项字母。';
	if (kind.includes('multiple') || kind.includes('多选'))
		answerRule = '这是多选题，返回所有正确选项的完整文字，用 ### 分隔，不要返回选项字母。';
	if (kind.includes('judg') || kind.includes('判断')) answerRule = '这是判断题，答案只能是“正确”或“错误”。';
	if (kind.includes('fill') || kind.includes('填空')) answerRule = '这是填空题，只返回应填内容；多空用 ### 分隔。';
	return [
		'你是严谨的课程题目答题助手。请先判断题意，再给出最可能正确的答案。',
		answerRule,
		'最后只输出一个 JSON 对象，格式为 {"answer":"答案"}，不要使用 Markdown。',
		`题型：${type || '未知'}`,
		`题目：${title}`,
		options ? `选项：\n${options}` : ''
	]
		.filter(Boolean)
		.join('\n\n');
}

function parseAnswer(content: string, options: string, type: string) {
	const text = content
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	let answer = text;
	const jsonStart = text.indexOf('{');
	const jsonEnd = text.lastIndexOf('}');
	if (jsonStart >= 0 && jsonEnd > jsonStart) {
		try {
			const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
			if (typeof parsed.answer === 'string') answer = parsed.answer;
		} catch {
			// 兼容没有按 JSON 格式返回的模型。
		}
	}
	answer = answer.replace(/^答案\s*[:：]\s*/i, '').trim();
	if (!answer) throw new Error('模型没有返回答案。');

	if (type.toLowerCase().includes('判断') || type.toLowerCase().includes('judg')) {
		if (/正确|是|true/i.test(answer)) return '正确';
		if (/错误|否|false/i.test(answer)) return '错误';
	}

	const markers = Array.from(options.matchAll(/(^|\s)([A-Ha-hＡ-Ｈ])\s*[.．、:：)）]\s*/g));
	const optionMap = new Map<string, string>();
	markers.forEach((marker, index) => {
		const label = String(marker[2])
			.replace(/[Ａ-Ｈ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
			.toUpperCase();
		const start = marker.index! + marker[0].length;
		const end = index + 1 < markers.length ? markers[index + 1].index! : options.length;
		const value = options.slice(start, end).trim();
		if (value) optionMap.set(label, value);
	});
	const direct = optionMap.get(
		answer
			.toUpperCase()
			.replace(/[.．、:：)）]/g, '')
			.trim()
	);
	if (direct) return direct;
	const mapped = answer
		.split(/\s*(?:###|\n|[;,，、])\s*/)
		.map((part) => {
			const key = part.trim().match(/^([A-Ha-hＡ-Ｈ])(?:\s*[.．、:：)）-].*)?$/)?.[1];
			if (!key) return part.trim();
			const label = key.replace(/[Ａ-Ｈ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248)).toUpperCase();
			return optionMap.get(label) || part.trim();
		})
		.filter(Boolean);
	return mapped.length ? mapped.join('###') : answer;
}

function findExactQuestion(title: string, options: string) {
	const normalizedTitle = normalizeText(title);
	const normalizedOptions = normalizeText(options);
	if (!normalizedTitle) return undefined;
	return readQuestions()
		.filter((question) => {
			if (question.source === 'ai' && !question.verified) return false;
			if (normalizeText(question.title) !== normalizedTitle) return false;
			const storedOptions = normalizeText(question.options || '');
			return !normalizedOptions || !storedOptions || normalizedOptions === storedOptions;
		})
		.sort((a, b) => Number(b.verified) - Number(a.verified) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function queryQuestionBank(input: {
	title: string;
	options?: string;
	type?: string;
	images?: string[] | string;
}) {
	const title = String(input?.title || '').trim();
	const options = String(input?.options || '').trim();
	const type = String(input?.type || '').trim();
	if (!title) throw new Error('题目内容不能为空。');
	const stored = findExactQuestion(title, options);
	if (stored) return { id: stored.id, answer: stored.answer, source: 'bank' as const, question: title };

	const settings = readSettings();
	const provider = settings.providers.find((item) => item.id === settings.selectedProviderId && item.enabled);
	if (!provider) throw new Error('尚未配置可用模型。请在软件侧边栏「模型接入」中添加并保存模型。');
	const prompt = buildPrompt(title, options, type);
	const content = await callProvider(provider, prompt, parseImages(input.images), 800, title);
	const answer = parseAnswer(content, options, type);
	let id = `ai-${crypto.randomUUID()}`;
	if (settings.autoSaveAiAnswers) {
		const saved = saveQuestionBankQuestion({ title, options, type, answer, source: 'ai', verified: false });
		id = saved.id;
	}
	return { id, answer, source: 'ai' as const, question: title };
}

function providerWithSavedKey(input: QuestionBankProvider): QuestionBankProvider {
	const current = readSettings().providers.find((provider) => provider.id === input.id);
	const provider = {
		...input,
		baseUrl: String(input.baseUrl || '').trim(),
		model: String(input.model || '').trim(),
		apiKey: input.clearApiKey ? '' : String(input.apiKey || '').trim() || current?.apiKey || ''
	};
	validateProviderAddress(provider);
	return provider;
}

export async function listQuestionBankModels(input: QuestionBankProvider) {
	return listProviderModels(providerWithSavedKey(input));
}

export async function testQuestionBankProvider(input: QuestionBankProvider) {
	const provider = providerWithSavedKey(input);
	if (!provider.model || !provider.baseUrl) throw new Error('请填写服务地址和模型 ID。');
	const startedAt = Date.now();
	const content = await callProvider(provider, '请只返回 JSON：{"answer":"OK"}', [], 64);
	if (!content.trim()) throw new Error('模型接口已响应，但没有返回文本内容。');
	return { ok: true, elapsedMs: Date.now() - startedAt, response: content.slice(0, 200) };
}
