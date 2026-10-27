import type { QuestionBankProvider } from './question-bank';

export type CapabilityPreset = 'auto' | 'openai' | 'qwen' | 'deepseek' | 'compatible';

export function capabilityPreset(provider: QuestionBankProvider): CapabilityPreset {
	if (provider.capabilityPreset && provider.capabilityPreset !== 'auto') return provider.capabilityPreset;
	const host = new URL(provider.baseUrl).hostname;
	if (/dashscope\./i.test(host) || /^qwen/i.test(provider.model)) return 'qwen';
	if (host === 'api.deepseek.com' || /^deepseek/i.test(provider.model)) return 'deepseek';
	if (host === 'api.openai.com' || /^(?:gpt-|o[134](?:-|$))/i.test(provider.model)) return 'openai';
	return 'compatible';
}

/** Extra inference parameters are provider specific; never silently drop an enabled capability. */
export function thinkingParameters(provider: QuestionBankProvider): Record<string, unknown> {
	if (provider.reasoningEnabled !== true) return {};
	if (provider.protocol === 'anthropic') {
		const version = provider.model.match(/(?:opus|sonnet|haiku|fable)[-.](\d+)(?:[-.](\d+))?/i);
		const adaptive = /mythos/i.test(provider.model) || (version && (Number(version[1]) >= 5 || Number(version[1]) === 4 && Number(version[2]) >= 6));
		return adaptive
			? { thinking: { type: 'adaptive' }, output_config: { effort: 'high' } }
			: { thinking: { type: 'enabled', budget_tokens: 4096 } };
	}
	if (provider.protocol === 'gemini') {
		return { thinkingConfig: /gemini-2\.5/i.test(provider.model) ? { thinkingBudget: 4096 } : { thinkingLevel: 'HIGH' } };
	}
	const preset = capabilityPreset(provider);
	if (preset === 'qwen') return { enable_thinking: true };
	if (preset === 'deepseek') return { thinking: { type: 'enabled' }, reasoning_effort: 'high' };
	return { reasoning_effort: 'high' };
}
