import { computed, nextTick, onActivated, onDeactivated, onUnmounted, reactive, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { remote } from '../utils/remote';
import { inBrowser } from '../utils/node';
import { connectQuestionBank } from '../utils/connect-question-bank';

export function useDoubao() {
	const status = reactive({ running: false, loggedIn: false });
	const error = ref('');
	const busy = ref(false);
	const saving = ref(false);
	const sending = ref(false);
	const draft = ref('');
	const model = ref('doubao-fast');
	const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);
	const conversationId = ref('');
	const messageArea = ref<HTMLElement>();
	const suggestions = ['帮我梳理一道题的解题思路', '解释一个概念，并举个例子', '帮我制定今天的复习计划'];
	const modelOptions = [
		{ value: 'doubao-fast', label: '豆包 · 快速' },
		{ value: 'doubao-expert', label: '豆包 · 专家' },
		{ value: 'doubao-auto', label: '豆包 · 自动' },
		{ value: 'doubao-turbo', label: '豆包 2.1 Turbo' },
		{ value: 'doubao-pro', label: '豆包 2.1 Pro' },
		{ value: 'doubao-2.1-lite', label: '豆包 2.1 Lite' }
	];
	const modelLabel = computed(() => modelOptions.find((item) => item.value === model.value)?.label || '豆包');
	const qrVisible = ref(false),
		qrLoading = ref(false),
		qrImage = ref(''),
		qrStatus = ref('准备二维码…');
	const cookieVisible = ref(false),
		cookie = ref(''),
		webWaiting = ref(false);
	let qrToken = '',
		qrGeneration = 0;
	let qrTimer: ReturnType<typeof setTimeout> | undefined;
	let webTimer: ReturnType<typeof setTimeout> | undefined;
	let active = false;
	async function refresh() {
		if (inBrowser) {
			error.value = '豆包登录与答题需要在桌面应用中使用。';
			return;
		}
		try {
			const result = await remote.methods.call('getDoubaoStatus');
			Object.assign(status, result);
			error.value = result.loginError || '';
			if (result.loggedIn) {
				webWaiting.value = false;
				clearTimeout(webTimer);
			}
		} catch (e) {
			error.value = String(e);
		}
	}
	async function showQr() {
		qrVisible.value = true;
		await createQr();
	}
	function stopQr() {
		qrGeneration++;
		clearTimeout(qrTimer);
		qrToken = '';
	}
	async function createQr() {
		stopQr();
		const generation = qrGeneration;
		qrLoading.value = true;
		qrImage.value = '';
		qrStatus.value = '正在获取二维码…';
		try {
			const result = await remote.methods.call('startDoubaoQr');
			if (generation !== qrGeneration || !qrVisible.value) return;
			qrToken = result.token;
			if (!/^data:image\/(png|jpeg|webp);base64,/.test(result.image)) throw new Error('二维码格式无效，请重试。');
			qrImage.value = result.image;
			qrStatus.value = '等待扫码';
			qrTimer = setTimeout(() => pollQr(generation), 1800);
		} catch (e) {
			qrStatus.value = `获取失败：${String(e)}`;
		} finally {
			if (generation === qrGeneration) qrLoading.value = false;
		}
	}
	async function pollQr(generation: number) {
		if (!active || !qrVisible.value || generation !== qrGeneration) return;
		try {
			const result = await remote.methods.call('pollDoubaoQr', qrToken);
			if (generation !== qrGeneration) return;
			if (result.confirmed) {
				stopQr();
				qrVisible.value = false;
				await refresh();
				Message.success('豆包账号已连接。');
				return;
			}
			if (result.status === 'expired') {
				qrStatus.value = '二维码已过期，请刷新。';
				return;
			}
			qrStatus.value = result.status === 'scanned' ? '已扫码，请在手机上确认' : '等待扫码';
			qrTimer = setTimeout(() => pollQr(generation), 1800);
		} catch (e) {
			qrStatus.value = `扫码状态检查失败：${String(e)}`;
		}
	}
	async function webLogin() {
		busy.value = true;
		error.value = '';
		try {
			await remote.methods.call('openDoubaoLogin');
			webWaiting.value = true;
			watchWebLogin();
		} catch (e) {
			error.value = String(e);
		} finally {
			busy.value = false;
		}
	}
	function watchWebLogin() {
		clearTimeout(webTimer);
		if (!active || !webWaiting.value) return;
		webTimer = setTimeout(async () => {
			await refresh();
			watchWebLogin();
		}, 4000);
	}
	async function saveCookie() {
		busy.value = true;
		try {
			Object.assign(status, await remote.methods.call('importDoubaoCookie', cookie.value.trim()));
			cookie.value = '';
			error.value = '';
			Message.success('Cookie 已加密保存。');
			return true;
		} catch (e) {
			error.value = String(e);
			return false;
		} finally {
			busy.value = false;
		}
	}
	function logout() {
		Modal.confirm({
			title: '退出豆包账号',
			content: '将清除本机保存的豆包登录凭据。',
			async onOk() {
				busy.value = true;
				try {
					Object.assign(status, await remote.methods.call('logoutDoubao'));
					newConversation();
				} catch (e) {
					error.value = String(e);
				} finally {
					busy.value = false;
				}
			}
		});
	}
	async function useForAnswers() {
		saving.value = true;
		try {
			const settings = await remote.methods.call('getQuestionBankConfig');
			const provider = settings.providers.find((item) => item.id === 'builtin-doubao');
			if (!provider) throw new Error('内置豆包配置不存在。');
			provider.model = model.value;
			provider.enabled = true;
			settings.selectedProviderId = provider.id;
			await remote.methods.call('saveQuestionBankConfig', settings);
			await connectQuestionBank();
			Message.success('豆包已设为默认答题模型，课程同步已开启。');
		} catch (e) {
			error.value = String(e);
		} finally {
			saving.value = false;
		}
	}
	function newConversation() {
		if (sending.value) return;
		messages.value = [];
		conversationId.value = '';
		error.value = '';
	}
	async function scrollMessages() {
		await nextTick();
		messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' });
	}
	async function send() {
		if (sending.value || !draft.value.trim() || !status.loggedIn) return;
		const prompt = draft.value.trim();
		draft.value = '';
		sending.value = true;
		error.value = '';
		messages.value.push({ role: 'user', content: prompt });
		await scrollMessages();
		try {
			const result = await remote.methods.call('chatDoubao', {
				prompt,
				model: model.value,
				conversationId: conversationId.value
			});
			messages.value.push({ role: 'assistant', content: result.content });
			conversationId.value = result.conversationId;
		} catch (e) {
			error.value = String(e);
			draft.value = prompt;
		} finally {
			sending.value = false;
			await scrollMessages();
		}
	}
	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			Message.success('已复制回答。');
		} catch {
			Message.error('复制失败，请手动选择回答文本。');
		}
	}
	onActivated(async () => {
		active = true;
		await refresh();
		watchWebLogin();
		if (!inBrowser) {
			try {
				const settings = await remote.methods.call('getQuestionBankConfig');
				model.value = settings.providers.find((item) => item.id === 'builtin-doubao')?.model || 'doubao-fast';
			} catch {}
		}
	});
	function pause() {
		active = false;
		stopQr();
		qrVisible.value = false;
		clearTimeout(webTimer);
	}
	onDeactivated(pause);
	onUnmounted(pause);
	return {
		status,
		error,
		busy,
		saving,
		sending,
		draft,
		model,
		messages,
		messageArea,
		suggestions,
		modelOptions,
		modelLabel,
		qrVisible,
		qrLoading,
		qrImage,
		qrStatus,
		cookieVisible,
		cookie,
		webWaiting,
		refresh,
		showQr,
		stopQr,
		createQr,
		webLogin,
		saveCookie,
		logout,
		useForAnswers,
		newConversation,
		send,
		copy
	};
}
