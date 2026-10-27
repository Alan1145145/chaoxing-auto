<template>
	<div class="question-bank">
		<header class="page-header">
			<div>
				<div class="dew-eyebrow">INTELLIGENCE, CONNECTED</div><h2>找到适合你的学习助手。</h2>
				<div class="page-status">选择答题模型。保存后，课程里的自动答题会使用这个模型。</div>
			</div>
			<a-button
				type="primary"
				:loading="savingConfig"
				:disabled="!selectedProvider"
				@click="saveConfig"
			>
				<Icon type="save" />
				保存配置
			</a-button>
		</header>

		<section class="content-section model-section">
			<div class="model-toolbar">
				<div>
					<div class="section-title">已配置模型</div>
					<div class="page-status">支持 OpenAI 兼容接口、Anthropic 和 Gemini。API Key 会继续保留在本地加密配置中。</div>
				</div>
				<a-space>
					<a-button @click="addQwen">接入千问</a-button>
					<a-button
						type="primary"
						@click="openProviderEditor()"
					>
						<Icon type="add" />
						添加模型
					</a-button>
				</a-space>
			</div>

			<div class="model-options">
				<div class="setting-row">
					<div>
						<div class="setting-label">默认模型</div>
						<div class="page-status">自动答题使用此模型作答。</div>
					</div>
					<a-select
						:model-value="settings.selectedProviderId || undefined"
						:options="enabledProviderOptions"
						:disabled="enabledProviderOptions.length === 0"
						placeholder="选择默认模型"
						style="width: 300px"
						@change="setDefaultProvider"
					/>
				</div>
			</div>

			<div class="ocs-config-card">
				<div>
					<div class="section-title">脚本接入</div>
					<div class="page-status">保存模型或切换默认模型后自动接入 OCS JS，已打开的课程页会自动同步。</div>
				</div>
				<div
					class="ocs-save-status"
					:data-state="ocsSaveState"
				>
					<span class="ocs-save-dot" />
					{{ ocsSaveMessage }}
				</div>
			</div>

			<div class="api-endpoint-row">
				<span class="page-status">服务地址</span>
				<code>{{ questionBankEndpoint }}</code>
				<span class="page-status">课程脚本通过此地址把题目发给所选模型</span>
			</div>

<div class="provider-grid"><article v-for="provider in settings.providers" :key="provider.id" class="provider-card" :class="{selected: provider.id === settings.selectedProviderId}"><div class="provider-card-head"><span class="provider-logo"><Icon :type="provider.id === 'builtin-doubao' ? 'auto_awesome' : 'hub'" :size="25" /></span><div><h3>{{ provider.name }}</h3><small>{{ provider.id === 'builtin-doubao' ? '内置 · 账号登录' : protocolLabel(provider.protocol) }}</small></div><span v-if="provider.id === settings.selectedProviderId" class="dew-pill ready" style="margin-left:auto">默认</span></div><div class="provider-model-id">{{ provider.model }}</div><span class="dew-pill">{{ provider.enabled ? '已启用' : '已停用' }} · {{ provider.id === 'builtin-doubao' ? '登录后可用' : provider.hasApiKey ? '密钥已保存' : '未配置密钥' }}</span><div class="provider-card-footer"><button class="dew-link" :disabled="!provider.enabled" @click="setDefaultProvider(provider.id)">{{ provider.id === settings.selectedProviderId ? '当前答题模型' : '选为默认模型 ↗' }}</button><div class="provider-actions"><a-button type="text" size="mini" title="测试模型" @click="testProvider(provider)"><Icon type="bolt" :size="17" /></a-button><a-button type="text" size="mini" title="配置模型" @click="openProviderEditor(provider)"><Icon type="tune" :size="17" /></a-button><a-button v-if="provider.id !== 'builtin-doubao'" type="text" status="danger" size="mini" title="删除模型" @click="removeProvider(provider)"><Icon type="delete" :size="17" /></a-button></div></div></article><button class="provider-add" @click="openProviderEditor()"><Icon type="add_circle_outline" :size="32" /><span>连接一个新模型</span><small>OpenAI · Anthropic · Gemini</small></button></div>
		</section>

		<a-modal
			v-model:visible="providerModalVisible"
			:title="providerEditing ? '编辑模型接入' : '添加模型接入'"
			:ok-loading="savingProvider"
			:width="620"
			:on-before-ok="saveProvider"
		>
			<a-form
				:model="providerForm"
				layout="vertical"
			>
				<div class="form-grid">
					<a-form-item
						label="名称"
						required
					>
						<a-input
							v-model="providerForm.name"
							placeholder="例如：DeepSeek"
						/>
					</a-form-item>
					<a-form-item
						label="接口协议"
						required
					>
						<a-select v-model="providerForm.protocol" @change="changeProviderProtocol">
							<a-option value="openai-chat">OpenAI 兼容</a-option>
							<a-option value="anthropic">Anthropic Messages</a-option>
							<a-option value="gemini">Google Gemini</a-option>
						</a-select>
					</a-form-item>
				</div>
				<a-form-item
					label="服务地址"
					required
				>
					<a-input
						v-model="providerForm.baseUrl"
						:placeholder="baseUrlPlaceholder"
					/>
				</a-form-item>
				<a-form-item
					label="模型 ID"
					required
				>
					<div class="model-picker">
						<a-select
							v-if="availableModels.length"
							v-model="providerForm.model"
							:options="modelOptions"
							allow-search
							allow-create
							placeholder="选择或输入模型 ID"
						/>
						<a-input v-else v-model="providerForm.model" placeholder="例如：deepseek-chat" />
						<a-button :loading="fetchingModels" :disabled="!providerForm.baseUrl.trim()" @click="fetchModels">
							一键获取模型
						</a-button>
					</div>
				</a-form-item>
				<a-alert v-if="modelFetchError" type="warning" class="model-fetch-feedback">{{ modelFetchError }}</a-alert>
				<div v-else-if="availableModels.length" class="page-status model-fetch-feedback">
					已获取 {{ availableModels.length }} 个模型，可搜索选择，也可手动输入模型 ID。
				</div>
				<a-form-item label="API Key">
					<a-input-password
						v-model="providerForm.apiKey"
						:placeholder="providerForm.hasApiKey ? '留空以保留已保存的密钥' : '输入 API Key'"
					/>
					<a-checkbox
						v-if="providerForm.hasApiKey"
						v-model="providerForm.clearApiKey"
						class="clear-key"
					>
						清除已保存的密钥
					</a-checkbox>
				</a-form-item>
				<a-form-item>
					<a-switch v-model="providerForm.enabled" />
					<span class="inline-label">启用该模型</span>
					<a-button style="margin-left: auto" :loading="testingProviderId === providerForm.id" @click="testProvider(providerForm)">测试连接</a-button>
				</a-form-item>
				<div
					v-if="providerForm.id === QWEN_PROVIDER_ID"
					class="page-status"
				>
					通义千问（阿里云百炼）使用 OpenAI 兼容接口，服务地址为 {{ QWEN_BASE_URL }}（华北2·北京地域），默认模型 qwen-plus，可改为 qwen-max、qwen-turbo
					等。API Key 需在百炼控制台创建，且必须与服务地址同一地域。
					<a
						class="dew-link"
						href="https://bailian.console.aliyun.com/?apiKey=1"
						@click.prevent="openExternal('https://bailian.console.aliyun.com/?apiKey=1')"
						>获取 API Key ↗</a
					>
					<a
						class="dew-link"
						href="https://help.aliyun.com/zh/model-studio/get-api-key"
						@click.prevent="openExternal('https://help.aliyun.com/zh/model-studio/get-api-key')"
						>查看说明 ↗</a
					>
				</div>
				<div
					v-else
					class="page-status"
				>
					填写服务地址和 API Key 后，点击「一键获取模型」选择模型；也可手动填写模型 ID。点击确定即可保存并自动接入 OCS JS。
				</div>
			</a-form>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { computed, onActivated, reactive, ref, watch } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import type {
	QuestionBankModel,
	QuestionBankProtocol,
	QuestionBankProvider,
	QuestionBankSettings
} from '@ocs-desktop/app';
import { connectQuestionBank } from '@/utils/connect-question-bank';
import Icon from '@/components/Icon.vue';
import { remote } from '@/utils/remote';
import { store } from '@/store';
import { useRouter } from 'vue-router';
import { electron, inBrowser } from '../../utils/node';
const router = useRouter();

type ProviderForm = QuestionBankProvider & { apiKey: string; clearApiKey: boolean };

const emptyProvider = (): ProviderForm => ({
	id: `provider-${Date.now()}`,
	name: '',
	protocol: 'openai-chat',
	baseUrl: 'https://api.openai.com/v1',
	model: '',
	apiKey: '',
	enabled: true,
	hasApiKey: false,
	clearApiKey: false
});

const settings = ref<QuestionBankSettings>({ providers: [], selectedProviderId: null, autoSaveAiAnswers: true });
const savingConfig = ref(false);
const savingProvider = ref(false);
const providerModalVisible = ref(false);
const providerEditing = ref(false);
const providerForm = reactive<ProviderForm>(emptyProvider());
const availableModels = ref<QuestionBankModel[]>([]);
const fetchingModels = ref(false);
const modelFetchError = ref('');
const testingProviderId = ref('');
let modelRequestId = 0;
const modelOptions = computed(() => {
	const options = availableModels.value.map((model) => ({
		label: model.name === model.id ? model.id : `${model.name} · ${model.id}`,
		value: model.id
	}));
	if (providerForm.model && !options.some((option) => option.value === providerForm.model)) {
		options.unshift({ label: `${providerForm.model}（手动填写）`, value: providerForm.model });
	}
	return options;
});
watch(
	() => [
		providerForm.id,
		providerForm.protocol,
		providerForm.baseUrl,
		providerForm.apiKey,
		providerForm.clearApiKey,
		providerModalVisible.value
	],
	() => {
		modelRequestId++;
		availableModels.value = [];
		modelFetchError.value = '';
		fetchingModels.value = false;
	},
	{ flush: 'sync' }
);
const ocsSaveState = ref<'idle' | 'success' | 'error'>('idle');
const ocsSaveMessage = ref('尚未保存到 OCS');

const enabledProviderOptions = computed(() =>
	settings.value.providers
		.filter((provider) => provider.enabled)
		.map((provider) => ({ label: `${provider.name} · ${provider.model}`, value: provider.id }))
);
const selectedProvider = computed(() =>
	settings.value.providers.find((provider) => provider.id === settings.value.selectedProviderId && provider.enabled)
);
const baseUrlPlaceholder = computed(() => {
	if (providerForm.protocol === 'anthropic') return 'https://api.anthropic.com';
	if (providerForm.protocol === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta';
	return 'https://api.openai.com/v1';
});
const questionBankEndpoint = computed(() => `http://localhost:${Number(store.server.port) || 15319}/query`);
const ocsStore = computed<Record<string, any>>(() => {
	const value = store.render.setting.ocs.store;
	return value && typeof value === 'object' ? (value as Record<string, any>) : {};
});
const ocsConfigured = computed(() => {
	const wrappers = ocsStore.value['common.settings.answererWrappers'];
	return Array.isArray(wrappers) && wrappers.some((wrapper) => wrapper?.name === 'OCS 内置题库');
});

function protocolLabel(protocol: QuestionBankProtocol) {
	return protocol === 'anthropic' ? 'Anthropic Messages' : protocol === 'gemini' ? 'Google Gemini' : 'OpenAI 兼容';
}

async function loadSettings() {
	if (inBrowser) return;
	try {
		settings.value = await remote.methods.call('getQuestionBankConfig');
		if (ocsConfigured.value) {
			ocsSaveState.value = 'success';
			ocsSaveMessage.value = store.render.setting.ocs.openSync
				? '已接入 OCS，浏览器同步已开启'
				: '已接入 OCS，当前浏览器同步未开启';
		}
	} catch (error) {
		Message.error(String(error));
	}
}

async function setDefaultProvider(value: string | number | undefined) {
	if (savingConfig.value) return;
	settings.value.selectedProviderId = value ? String(value) : null;
	await saveConfig();
}

function changeProviderProtocol() {
	const defaults = {
		'openai-chat': 'https://api.openai.com/v1',
		anthropic: 'https://api.anthropic.com',
		gemini: 'https://generativelanguage.googleapis.com/v1beta'
	};
	if (Object.values(defaults).includes(providerForm.baseUrl)) providerForm.baseUrl = defaults[providerForm.protocol];
	providerForm.model = '';
}

async function fetchModels() {
	const requestId = ++modelRequestId;
	fetchingModels.value = true;
	modelFetchError.value = '';
	try {
		const models = await remote.methods.call('listQuestionBankModels', { ...providerForm });
		if (requestId !== modelRequestId) return;
		availableModels.value = models;
		if (!providerForm.model.trim()) providerForm.model = models[0]?.id || '';
		Message.success(`已获取 ${models.length} 个模型。`);
	} catch (error) {
		if (requestId === modelRequestId) modelFetchError.value = String(error);
	} finally {
		if (requestId === modelRequestId) fetchingModels.value = false;
	}
}

/** 通义千问：阿里云百炼 OpenAI 兼容接口（华北2·北京） */
const QWEN_PROVIDER_ID = 'qwen-dashscope';
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

function openExternal(url: string) {
	if (!inBrowser && electron.shell?.openExternal) void electron.shell.openExternal(url);
	else window.open(url, '_blank');
}

function addQwen() {
	const existing = settings.value.providers.find((provider) => provider.id === QWEN_PROVIDER_ID);
	providerEditing.value = Boolean(existing);
	Object.assign(providerForm, emptyProvider(), existing || {}, {
		id: QWEN_PROVIDER_ID,
		name: '通义千问',
		protocol: 'openai-chat',
		baseUrl: existing?.baseUrl || QWEN_BASE_URL,
		model: existing?.model || 'qwen-plus',
		apiKey: '',
		enabled: true,
		hasApiKey: Boolean(existing?.hasApiKey),
		clearApiKey: false
	});
	providerModalVisible.value = true;
}

function openProviderEditor(provider?: QuestionBankProvider) {
	if (provider?.id === 'builtin-doubao') {
		void router.push('/doubao');
		return;
	}
	providerEditing.value = Boolean(provider);
	Object.assign(providerForm, emptyProvider(), provider || {});
	providerForm.apiKey = '';
	providerForm.clearApiKey = false;
	providerModalVisible.value = true;
}

async function saveProvider() {
	if (savingProvider.value || savingConfig.value) return false;
	if (!providerForm.name.trim() || !providerForm.model.trim() || !providerForm.baseUrl.trim()) {
		Message.warning('名称、服务地址和模型 ID 均不能为空。');
		return false;
	}
	savingProvider.value = true;
	let modelSettingsSaved = false;
	try {
		const provider = { ...providerForm };
		const providers = settings.value.providers.filter((item) => item.id !== provider.id).concat(provider);
		settings.value = await remote.methods.call('saveQuestionBankConfig', {
			...settings.value,
			providers,
			selectedProviderId: !providerEditing.value && provider.enabled ? provider.id : settings.value.selectedProviderId
		});
		modelSettingsSaved = true;
		await connectQuestionBank();
		ocsSaveState.value = 'success';
		ocsSaveMessage.value = '已保存并接入 OCS，课程脚本将自动同步';
		Message.success('模型已保存并自动接入 OCS JS。');
		return true;
	} catch (error) {
		ocsSaveState.value = 'error';
		ocsSaveMessage.value = modelSettingsSaved
			? `模型已保存，但 OCS 接入失败：${String(error)}`
			: `保存失败：${String(error)}`;
		Message.error(ocsSaveMessage.value);
		return false;
	} finally {
		savingProvider.value = false;
	}
}

async function testProvider(provider: QuestionBankProvider) {
	if (testingProviderId.value) return;
	testingProviderId.value = provider.id;
	try {
		const result = await remote.methods.call('testQuestionBankProvider', provider);
		Message.success(`模型连接成功，耗时 ${result.elapsedMs} ms。`);
	} catch (error) {
		Message.error(`模型连接失败：${String(error)}`);
	} finally {
		testingProviderId.value = '';
	}
}

function removeProvider(provider: QuestionBankProvider) {
	Modal.confirm({
		title: '删除模型接入',
		content: `确定删除“${provider.name}”吗？`,
		async onOk() {
			try {
				const providers = settings.value.providers.filter((item) => item.id !== provider.id);
				settings.value = await remote.methods.call('saveQuestionBankConfig', {
					...settings.value,
					providers,
					selectedProviderId:
						settings.value.selectedProviderId === provider.id
							? providers.find((item) => item.enabled)?.id || null
							: settings.value.selectedProviderId
				});
				await connectQuestionBank();
				ocsSaveState.value = 'success';
				ocsSaveMessage.value = '已保存并接入 OCS，课程脚本将自动同步';
				Message.success('模型接入已删除。');
			} catch (error) {
				Message.error(String(error));
			}
		}
	});
}

async function saveConfig() {
	if (savingConfig.value || savingProvider.value) return;
	if (!selectedProvider.value) {
		Message.warning('请先添加并选择一个启用的模型。');
		return;
	}
	savingConfig.value = true;
	ocsSaveState.value = 'idle';
	ocsSaveMessage.value = '正在保存模型并接入 OCS...';
	let modelSettingsSaved = false;
	try {
		settings.value = await remote.methods.call('saveQuestionBankConfig', settings.value);
		modelSettingsSaved = true;
		await connectQuestionBank();
		ocsSaveState.value = 'success';
		ocsSaveMessage.value = '已保存并接入 OCS，课程脚本将自动同步';
		Message.success('模型已保存，自动答题会使用该模型。');
	} catch (error) {
		ocsSaveState.value = 'error';
		ocsSaveMessage.value = modelSettingsSaved
			? `模型已保存，但 OCS 配置保存失败：${String(error)}`
			: `保存失败：${String(error)}`;
		Message.error(ocsSaveMessage.value);
	} finally {
		savingConfig.value = false;
	}
}

onActivated(() => {
	void loadSettings();
});
</script>

<style scoped lang="less">
.model-picker {
	display: flex;
	gap: 8px;
	width: 100%;
	> :first-child { flex: 1; min-width: 0; }
}
.model-fetch-feedback { margin: -6px 0 16px; }
.question-bank {
	height: 100%;
	min-width: 0;
	overflow: auto;
	padding: 20px 24px 28px;
	box-sizing: border-box;
}

.page-header,
.model-toolbar,
.toolbar-actions,
.setting-row,
.ocs-config-card,
.api-endpoint-row {
	display: flex;
	align-items: center;
}

.page-header,
.model-toolbar,
.setting-row,
.ocs-config-card {
	justify-content: space-between;
	gap: 16px;
}

.page-header {
	margin-bottom: 16px;
	padding-bottom: 14px;
	border-bottom: 1px solid var(--color-border-2, #e5e6eb);
}

.page-header h2 {
	margin: 0 0 6px;
	font-size: 20px;
	font-weight: 600;
}

.page-status {
	color: var(--color-text-3, #86909c);
	font-size: 12px;
}

.content-section {
	min-width: 0;
}
.model-toolbar {
	margin: 12px 0 8px;
}
.toolbar-actions {
	flex-wrap: wrap;
	gap: 8px;
}
.section-title,
.setting-label {
	font-size: 14px;
	font-weight: 600;
}

.model-options {
	margin-bottom: 16px;
	border-top: 1px solid var(--color-border-2, #e5e6eb);
	border-bottom: 1px solid var(--color-border-2, #e5e6eb);
}

.setting-row {
	min-height: 60px;
	padding: 8px 0;
}

.ocs-config-card {
	padding: 16px;
	margin: 16px 0;
	border: 1px solid var(--color-border-2, #e5e6eb);
	border-radius: 10px;
	background: var(--color-fill-1, #f7f8fa);
}

.ocs-save-status {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	color: var(--color-text-3, #86909c);
	font-size: 12px;
}

.ocs-save-status[data-state='success'] {
	color: #00a870;
}
.ocs-save-status[data-state='error'] {
	color: #f53f3f;
}
.ocs-save-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: currentColor;
}

.api-endpoint-row {
	flex-wrap: wrap;
	gap: 12px;
	min-height: 48px;
	margin: 12px 0;
	padding: 0 12px;
	border-top: 1px solid var(--color-border-2, #e5e6eb);
	border-bottom: 1px solid var(--color-border-2, #e5e6eb);
}

.api-endpoint-row code {
	padding: 4px 7px;
	border-radius: 4px;
	background: var(--color-fill-2, #f2f3f5);
	font-size: 13px;
}

.form-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}
.clear-key {
	display: block;
	margin-top: 6px;
}
.inline-label {
	margin-left: 8px;
}

@media (max-width: 760px) {
	.question-bank {
		padding: 14px;
	}
	.page-header,
	.model-toolbar,
	.setting-row,
	.ocs-config-card {
		align-items: flex-start;
		flex-direction: column;
	}
	.form-grid {
		grid-template-columns: 1fr;
		gap: 0;
	}
}
</style>
