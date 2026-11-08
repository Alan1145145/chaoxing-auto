/**
 * 模型请求韧性层。
 *
 * 背景：内置豆包网关转发的是豆包网页版接口，短时间内连续答题会触发豆包风控：
 *   rate limited (风控要求验证: type=verify subtype=semantic_reasoning) [logid=…]
 * 旧实现把这段上游原文直接抛给课程脚本，整道题失败、刷课暂停。
 *
 * 本模块负责：
 * 1. 把上游错误归类为 risk（风控）/ rate（限流）/ transient（瞬时）/ fatal（配置等硬错误）；
 * 2. 命中风控或限流的模型进入冷却，冷却期内不再请求，避免越试越封；
 * 3. 按「当前选中的模型 → 其余已启用模型」顺序自动降级，让这一道题尽量答完。
 */

export type ProviderFailureKind = 'risk' | 'rate' | 'transient' | 'fatal';

export interface FallbackProvider {
	id: string;
	name?: string;
	model?: string;
	enabled?: boolean;
}

export interface ProviderFailure {
	id: string;
	name: string;
	kind: ProviderFailureKind;
	message: string;
}

export const RISK_COOLDOWN_MS = 180000;
export const RATE_COOLDOWN_MS = 60000;
/** 相邻两次模型调用之间的最小间隔，降低触发风控的概率。 */
export const MIN_CALL_GAP_MS = 900;

const RISK_PATTERN =
	/(风控|风险控制|semantic_reasoning|type\s*=\s*verify|verify\s*required|captcha|验证码|risk\s*control|unusual\s*activity|abnormal\s*activity|异常行为|已被限制|账号存在异常|内容审核)/i;
const RATE_PATTERN =
	/(rate\s*limit|too\s*many\s*requests|\b429\b|限流|请求过于频繁|频率过快|no\s*healthy|temporarily\s*unavailable|账号暂不可用|冷却中)/i;
const TRANSIENT_PATTERN =
	/(timeout|timed\s*out|超时|ECONNRESET|ECONNABORTED|ETIMEDOUT|socket\s*hang\s*up|network\s*error|fetch\s*failed|网络异常|网关进程已退出)/i;

/** 尽量从各种错误形状里提取可判定的文本，不序列化完整 AxiosError。 */
export function errorText(error: unknown): string {
	if (!error) return '';
	if (typeof error === 'string') return error;
	const value = error as any;
	const parts: string[] = [];
	if (value.message) parts.push(String(value.message));
	const data = value.response?.data;
	if (data) {
		if (typeof data === 'string') parts.push(data);
		else if (typeof data?.error?.message === 'string') parts.push(data.error.message);
		else if (typeof data?.message === 'string') parts.push(data.message);
	}
	if (value.code) parts.push(String(value.code));
	return parts.join(' ').slice(0, 800);
}

/** 归类一次模型请求失败。 */
export function classifyFailure(error: unknown): ProviderFailureKind {
	const status = (error as any)?.response?.status;
	const text = errorText(error);
	if (RISK_PATTERN.test(text)) return 'risk';
	if (status === 429 || RATE_PATTERN.test(text)) return 'rate';
	if (TRANSIENT_PATTERN.test(text)) return 'transient';
	return 'fatal';
}

const cooldowns = new Map<string, { until: number; kind: ProviderFailureKind; detail: string }>();

/** 让一个模型进入冷却，只延长不缩短。返回冷却时长（毫秒）。 */
export function coolProvider(id: string, kind: ProviderFailureKind, detail: string): number {
	if (!id) return 0;
	const ms = kind === 'risk' ? RISK_COOLDOWN_MS : RATE_COOLDOWN_MS;
	const until = Date.now() + ms;
	const previous = cooldowns.get(id);
	if (!previous || until > previous.until) {
		cooldowns.set(id, { until, kind, detail: String(detail || '').slice(0, 300) });
	}
	return ms;
}

export function providerCooldown(id: string) {
	const entry = cooldowns.get(id);
	if (!entry) return null;
	if (entry.until <= Date.now()) {
		cooldowns.delete(id);
		return null;
	}
	return { remainingMs: entry.until - Date.now(), kind: entry.kind, detail: entry.detail };
}

export function isProviderCooling(id: string) {
	return providerCooldown(id) !== null;
}

export function clearProviderCooldown(id: string) {
	cooldowns.delete(id);
}

export function describeCooldown(id: string) {
	const info = providerCooldown(id);
	return info ? `${Math.ceil(info.remainingMs / 1000)} 秒` : '';
}

let lastCallAt = 0;
/** 相邻两次模型调用之间留出间隔，降低触发风控的概率。 */
export async function pace() {
	const wait = lastCallAt + MIN_CALL_GAP_MS - Date.now();
	if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
	lastCallAt = Date.now();
}

function providerLabel(provider: FallbackProvider) {
	return provider?.name || provider?.model || provider?.id || '未知模型';
}

export interface FallbackOptions<T> {
	providers: FallbackProvider[];
	selectedId?: string | null;
	run: (provider: FallbackProvider, attempt: number) => Promise<T>;
}

export interface FallbackOutcome<T> {
	value: T;
	provider: FallbackProvider;
	failures: ProviderFailure[];
}

/**
 * 按顺序尝试多个模型：选中的模型优先，其余已启用模型作为降级候选。
 * - risk/rate：立刻冷却该模型并换下一个（不在风控上重试，越试越封）；
 * - transient：同一模型重试一次后换下一个；
 * - fatal（Key 无效、地址错误等）：直接换下一个，最后把真实原因带回去。
 */
export async function answerWithFallback<T>(options: FallbackOptions<T>): Promise<FallbackOutcome<T>> {
	const providers = Array.isArray(options.providers) ? options.providers.filter((item) => item && item.enabled !== false) : [];
	const ordered: FallbackProvider[] = [];
	const seen = new Set<string>();
	const push = (provider?: FallbackProvider) => {
		if (!provider || seen.has(provider.id)) return;
		seen.add(provider.id);
		ordered.push(provider);
	};
	push(providers.find((provider) => provider.id === options.selectedId));
	providers.forEach(push);

	if (!ordered.length) throw new Error('尚未配置可用模型。请在软件侧边栏「模型接入」中添加并保存模型。');

	const failures: ProviderFailure[] = [];
	const cooling: Array<{ provider: FallbackProvider; cool: { remainingMs: number } }> = [];
	for (const provider of ordered) {
		const cool = providerCooldown(provider.id);
		if (cool) {
			cooling.push({ provider, cool });
			failures.push({
				id: provider.id,
				name: providerLabel(provider),
				kind: cool.kind,
				message: `冷却中（剩余 ${Math.ceil(cool.remainingMs / 1000)} 秒）`
			});
			continue;
		}
		const maxAttempts = 2;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				await pace();
				const value = await options.run(provider, attempt);
				return { value, provider, failures };
			} catch (error) {
				const kind = classifyFailure(error);
				const message = errorText(error) || (error instanceof Error ? error.message : String(error));
				if (kind === 'risk' || kind === 'rate') {
					coolProvider(provider.id, kind, message);
					failures.push({ id: provider.id, name: providerLabel(provider), kind, message });
					break;
				}
				if (kind === 'transient' && attempt < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 1200 : 2500));
					continue;
				}
				failures.push({ id: provider.id, name: providerLabel(provider), kind, message });
				break;
			}
		}
	}

	if (cooling.length === ordered.length && cooling.length > 0) {
		const longest = cooling.reduce((max, item) => Math.max(max, item.cool.remainingMs), 0);
		throw new Error(`当前所有模型都在冷却中（风控或限流），约 ${Math.ceil(longest / 1000)} 秒后再试；可在「模型接入」里换一个模型继续。`);
	}
	const risk = failures.find((item) => item.kind === 'risk');
	const detail = (risk || failures[0])?.message || '未知错误';
	if (risk) {
		throw new Error(
			`${risk.name} 触发服务商风控验证（type=verify / semantic_reasoning），已暂停该模型；` +
				`其余模型也没能作答：${detail.slice(0, 200)}。请稍后重试，或在「模型接入」中换模型 / 重新登录豆包完成验证。`
		);
	}
	throw new Error(`所有模型均未能作答：${String(detail).slice(0, 300)}`);
}
