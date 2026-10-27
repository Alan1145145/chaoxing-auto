/** Never pass a partial or refused completion to answer parsing / automatic storage. */
export function assertCompleteResponse(data: any, protocol: 'openai-chat' | 'anthropic' | 'gemini' | 'responses') {
	if (data?.error) throw new Error(String(data.error.message || '模型服务返回错误。'));
	if (protocol === 'openai-chat') {
		const choice = data?.choices?.[0];
		if (choice?.message?.refusal || choice?.delta?.refusal || choice?.finish_reason === 'content_filter') throw new Error('模型拒绝回答该题目。');
		if (choice?.finish_reason === 'length') throw new Error('模型回答因长度限制被截断，请提高输出限制或更换模型。');
		if (['tool_calls', 'function_call'].includes(choice?.finish_reason)) throw new Error('模型请求调用工具，尚未返回最终答案。');
	}
	if (protocol === 'anthropic' && data?.stop_reason && !['end_turn', 'stop_sequence'].includes(data.stop_reason)) {
		throw new Error(`模型尚未完成回答（${data.stop_reason}），请重试或更换模型。`);
	}
	if (protocol === 'gemini') {
		const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
		if (reason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(reason)) throw new Error(`模型未完成有效回答（${reason}）。`);
	}
	if (protocol === 'responses' && ['incomplete', 'failed', 'cancelled', 'queued', 'in_progress'].includes(data?.status)) {
		throw new Error(`模型尚未完成回答（${data.status}）。`);
	}
}

export function readOpenAIStream(payload: string) {
	const pieces: string[] = [];
	let complete = false;
	let pendingData: string[] = [];
	let eventType = '';
	const consume = () => {
		const kind = eventType; eventType = '';
		if (!pendingData.length) return;
		const raw = pendingData.join('\n'); pendingData = [];
		if (!raw.trim()) return;
		if (kind === 'error') {
			let detail = raw;
			try { const error = JSON.parse(raw); detail = error?.error?.message || error?.message || raw; } catch { /* Plain text error event. */ }
			throw new Error(detail);
		}
		if (raw.trim() === '[DONE]') { complete = true; return; }
		let event: any;
		try { event = JSON.parse(raw); } catch { throw new Error('模型流式响应格式无效，请重试。'); }
		assertCompleteResponse(event, 'openai-chat');
		const choice = event?.choices?.[0];
		if (choice?.finish_reason === 'stop') complete = true;
		const delta = choice?.delta?.content ?? choice?.message?.content;
		if (typeof delta === 'string') pieces.push(delta);
		else if (Array.isArray(delta)) pieces.push(...delta.filter((part) => typeof part?.text === 'string').map((part) => part.text));
	};
	for (const line of payload.replace(/^\uFEFF/, '').split(/\r?\n/)) {
		if (!line.trim()) { consume(); continue; }
		if (line.startsWith('event:')) eventType = line.slice(6).trim();
		if (line.startsWith('data:')) pendingData.push(line.slice(5).replace(/^ /, ''));
	}
	consume();
	if (!complete) throw new Error('模型流式响应中断，未收到完整答案。');
	return pieces.join('');
}
