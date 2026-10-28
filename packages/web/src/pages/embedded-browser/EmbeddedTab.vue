<template>
	<div class="embedded-browser-page">
		<div class="browser-toolbar">
			<a-button-group size="small">
				<a-button
					title="后退"
					:disabled="!canGoBack"
					@click="goBack"
					><Icon type="arrow_back"
				/></a-button>
				<a-button
					title="前进"
					:disabled="!canGoForward"
					@click="goForward"
					><Icon type="arrow_forward"
				/></a-button>
				<a-button
					:title="isLoading ? '停止加载' : '刷新网页'"
					@click="reload"
					><Icon type="refresh"
				/></a-button>
			</a-button-group>
			<a-button size="small" title="主页" @click="goHome">主页</a-button>
			<a-button size="small" :aria-pressed="browserFocusMode" @click="browserFocusMode = !browserFocusMode">{{ browserFocusMode ? '退出专注' : '专注浏览' }}</a-button>
			<a-input
				v-model="address"
				class="browser-address"
				placeholder="输入网址或搜索内容"
				@focus="addressEditing = true"
				@blur="addressEditing = false"
				@keyup.enter="navigate"
			>
				<template #suffix>
					<a-button
						type="text"
						size="mini"
						@click="navigate"
						>前往</a-button
					>
				</template>
			</a-input>
			<a-button
				size="small"
				:disabled="!webviewReady || syncingScripts"
				:loading="syncingScripts"
				@click="syncScripts(false)"
			>
				更新脚本
			</a-button>
			<a-button
				size="small"
				@click="closeBrowser"
				>返回列表</a-button
			>
		</div>
		<Transition name="browser-progress"><div v-if="isLoading && sessionReady" class="browser-progress-track" aria-label="网页加载中"><span /></div></Transition>

		<div
			v-if="!sessionReady && !stateError"
			class="browser-state"
		>
			<a-spin :tip="stateMessage" />
		</div>
		<div
			v-else-if="stateError"
			class="browser-state browser-error"
		>
			<a-result
				status="error"
				title="内嵌浏览器启动失败"
				:subtitle="stateError"
			>
				<template #extra>
					<a-button
						type="primary"
						@click="prepareSession"
						>重试</a-button
					>
				</template>
			</a-result>
		</div>
		<webview
			v-else
			:key="browserUid"
			ref="webviewRef"
			class="browser-webview"
			:partition="partition"
			:src="startUrl"
			allowpopups
			@dom-ready="onDomReady"
			@did-navigate="onNavigate"
			@did-navigate-in-page="onNavigate"
			@did-start-loading="isLoading = true"
			@did-stop-loading="onStopLoading"
			@destroyed="onWebviewDestroyed"
			@did-fail-load="onFailLoad"
			@page-title-updated="onTitleUpdated"
		></webview>
		<div
			v-if="isLoading && sessionReady"
			class="loading-indicator"
		>
			<a-spin :size="16" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import Icon from '../../components/Icon.vue';
import { Browser } from '../../fs/browser';
import { store } from '../../store';
import { remote } from '../../utils/remote';
import { addScriptFromUrl } from '../../utils/user-scripts';
import { filterScriptsNeedingInstall } from '../../utils/script-version';
import { browserFocusMode } from '../../composables/useEmbeddedBrowsers';

interface EmbeddedWebview extends HTMLElement {
	loadURL(url: string): Promise<void>;
	getURL(): string;
	getWebContentsId(): number;
	canGoBack(): boolean;
	canGoForward(): boolean;
	goBack(): void;
	goForward(): void;
	reload(): void;
	stop(): void;
	focus(): void;
}

const props = defineProps<{ uid: string; initialUrl?: string; active: boolean }>();
const emit = defineEmits<{ (event: 'ready', id: number): void; (event: 'title', title: string): void }>();
const router = useRouter();
const webviewRef = ref<EmbeddedWebview>();
const sessionReady = ref(false);
const stateError = ref('');
const stateMessage = ref('正在准备内嵌浏览器会话...');
const address = ref('');
const addressEditing = ref(false);
const pageTitle = ref('');
const isLoading = ref(true);
const syncingScripts = ref(false);
const webviewReady = ref(false);
let registeredWebContentsId: number | undefined;
let registeringWebContentsId: number | undefined;

const browserUid = computed(() => props.uid);
const browser = computed(() => Browser.from(browserUid.value));
const partition = computed(() => `persist:ocs-${browserUid.value}`);
const startUrl = computed(
	() => props.initialUrl || homeUrl.value
);
const homeUrl = computed(() => `http://localhost:${store.server.port || 15319}/start.html?uid=${encodeURIComponent(browserUid.value)}`);
watch(() => props.active, async (active) => {
	const id = getWebContentsId();
	if (active && id !== undefined) {
		addressEditing.value = false;
		await remote.methods.call('registerEmbeddedWebContents', browserUid.value, id, true);
		webviewRef.value?.focus();
	}
});
const canGoBack = ref(false);
const canGoForward = ref(false);

onMounted(() => {
	prepareSession();
});

async function prepareSession() {
	if (!browserUid.value) {
		stateError.value = '浏览器配置不存在。';
		return;
	}
	stateError.value = '';
	stateMessage.value = '正在准备内嵌浏览器会话...';
	sessionReady.value = false;
	webviewReady.value = false;
	registeredWebContentsId = undefined;
	try {
		await remote.methods.call('prepareEmbeddedBrowser', browserUid.value);
		sessionReady.value = true;
	} catch (error) {
		stateError.value = String(error);
	}
}

async function onDomReady() {
	const view = webviewRef.value;
	if (!view) return;
	const webContentsId = getWebContentsId(view);
	if (webContentsId === undefined) return;
	emit('ready', webContentsId);
	try {
		if (!addressEditing.value) address.value = view.getURL();
	} catch {
		return;
	}
	refreshNavigationState();
	if (registeredWebContentsId === webContentsId || registeringWebContentsId === webContentsId) return;
	registeringWebContentsId = webContentsId;
	try {
		await remote.methods.call('registerEmbeddedWebContents', browserUid.value, webContentsId, props.active);
		if (getWebContentsId() !== webContentsId) return;
		registeredWebContentsId = webContentsId;
		webviewReady.value = true;
		window.setTimeout(() => {
			if (registeredWebContentsId !== webContentsId) return;
			void syncScripts(true).finally(() => {
				if (props.active) void runConfiguredAutomation();
			});
		}, 600);
	} catch (error) {
		if (getWebContentsId() === webContentsId) {
			webviewReady.value = false;
			Message.error(`课程脚本桥接初始化失败：${String(error)}`);
		}
	} finally {
		if (registeringWebContentsId === webContentsId) registeringWebContentsId = undefined;
	}
}

function onWebviewDestroyed() {
	registeredWebContentsId = undefined;
	registeringWebContentsId = undefined;
	webviewReady.value = false;
}

function getWebContentsId(view = webviewRef.value) {
	try {
		return view?.getWebContentsId();
	} catch {
		return undefined;
	}
}

function onNavigate() {
	const view = webviewRef.value;
	if (view && !addressEditing.value) address.value = view.getURL();
	refreshNavigationState();
}

function onStopLoading() {
	isLoading.value = false;
	refreshNavigationState();
}

function onTitleUpdated(event: any) {
	pageTitle.value = event?.title || '';
	emit('title', pageTitle.value);
}

function onFailLoad(event: any) {
	if (event?.errorCode !== -3) {
		Message.error(`网页加载失败：${event?.errorDescription || event?.errorCode || '未知错误'}`);
	}
}

function refreshNavigationState() {
	const view = webviewRef.value;
	if (!view) return;
	canGoBack.value = view.canGoBack();
	canGoForward.value = view.canGoForward();
}

function goBack() {
	webviewRef.value?.goBack();
}

function goForward() {
	webviewRef.value?.goForward();
}

function reload() {
	if (isLoading.value) webviewRef.value?.stop();
	else webviewRef.value?.reload();
}

function goHome() { void webviewRef.value?.loadURL(homeUrl.value); }
function shortcut(key: string, alt = false) {
	if (key === 'l') {
		const input = webviewRef.value?.parentElement?.querySelector<HTMLInputElement>('.browser-address input');
		input?.focus(); input?.select();
	} else if (key === 'r' || key === 'f5') webviewRef.value?.reload();
	else if (alt && key === 'arrowleft' && canGoBack.value) goBack();
	else if (alt && key === 'arrowright' && canGoForward.value) goForward();
	else if (alt && key === 'home') goHome();
}
defineExpose({ shortcut });

function navigate() {
	const value = address.value.trim();
	if (!value || !webviewRef.value) return;
	addressEditing.value = false;
	const url = /^(https?|file|chrome-extension):\/\//i.test(value)
		? value
		: value.includes('.') && !value.includes(' ')
		? `https://${value}`
		: `https://www.baidu.com/s?wd=${encodeURIComponent(value)}`;
	webviewRef.value.loadURL(url).catch((error) => Message.error(String(error)));
}

async function runConfiguredAutomation() {
	const scripts = browser.value?.automationScripts || [];
	if (!scripts.length || !webviewReady.value) return;
	const names = scripts.map((script) => script.name).join('、');
	Message.info(`正在执行自动化程序：${names}`);
	try {
		const results = await remote.methods.call(
			'runEmbeddedAutomationScripts',
			browserUid.value,
			scripts.map((script) => ({ name: script.name, configs: script.configs }))
		);
		for (const result of results) {
			if (result.ok) Message.success(`自动化程序「${result.name}」已执行`);
			else Message.error(`自动化程序「${result.name}」未完成：${result.error || '未知错误'}`);
		}
	} catch (error) {
		Message.error(`自动化程序执行失败：${String(error)}`);
	}
}

async function syncScripts(onStartup = false) {
	const view = webviewRef.value;
	if (!view || !webviewReady.value || syncingScripts.value) return;
	if (registeredWebContentsId !== getWebContentsId(view)) {
		webviewReady.value = false;
		return;
	}
	syncingScripts.value = true;
	try {
		const currentBrowser = browser.value;
		await ensureLatestOfficialScript();
		const enabledScripts = store.render.scripts.filter((script) => script.enable);
		const ocsScript = enabledScripts.find(isOcsScript);
		if (!ocsScript) {
			await remote.methods.call('syncEmbeddedOcsjs', browserUid.value, false, getWebContentsId(view));
			if (!onStartup) Message.info('OCSJS 脚本当前处于停用状态。');
			return;
		}

		stateMessage.value = `正在加载用户脚本：${ocsScript.info?.name || 'OCS 网课助手'}`;
		const pending = await filterScriptsNeedingInstall([
			{
				...ocsScript,
				lastInstalledVersion: currentBrowser?.embeddedScriptVersions[String(ocsScript.id)]
			}
		]);
		const result = await remote.methods.call('syncEmbeddedOcsjs', browserUid.value, true, getWebContentsId(view));
		if (currentBrowser) {
			currentBrowser.embeddedScriptVersions[String(ocsScript.id)] =
				result.version || pending[0]?.latestVersion || ocsScript.info?.version || '';
		}

		const unsupportedScripts = enabledScripts.filter((script) => !isOcsScript(script));
		if (unsupportedScripts.length) {
			Message.warning('內嵌模式已載入 OCSJS；其他用户脚本暂不由内嵌运行器执行。');
		} else if (!onStartup) {
			Message.success(`OCSJS ${result.version ? `v${result.version} ` : ''}已加载。`);
		}
	} catch (error) {
		Message.error(`脚本更新失败：${String(error)}`);
	} finally {
		syncingScripts.value = false;
		stateMessage.value = '正在准备内嵌浏览器会话...';
	}
}

function isOcsScript(script: (typeof store.render.scripts)[number]) {
	const name = script.info?.name?.replace(/\s+/g, '').toLowerCase() || '';
	return (
		(name.includes('ocs') && name.includes('网课')) ||
		script.info?.url?.includes('ocsjs.com/ocs.user.js') ||
		script.url.includes('ocsjs.com/ocs.user.js') ||
		script.url.includes('/api/embedded-ocsjs.user.js')
	);
}

async function ensureLatestOfficialScript() {
	const scriptUrl = `http://localhost:${store.server.port || 15319}/api/embedded-ocsjs.user.js`;
	const existing = store.render.scripts.find((script) => !script.isLocalScript && isOcsScript(script));
	if (existing) {
		existing.url = scriptUrl;
		if (existing.info) {
			existing.info = {
				...existing.info,
				name: existing.info.name || 'OCS 网课助手',
				url: scriptUrl,
				code_url: scriptUrl
			};
		}
		existing.isInternetLinkScript = true;
		return;
	}
	await addScriptFromUrl(scriptUrl);
}

function closeBrowser() {
	store.render.browser.currentBrowserUid = '';
	router.push('/browsers');
}
</script>

<style scoped lang="less">
.embedded-browser-page {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 0;
	min-width: 0;
	overflow: hidden;
}

.browser-toolbar {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	gap: 8px;
	padding: 8px;
	background: var(--color-bg-2, #fff);
	border-bottom: 1px solid var(--color-border-2, #e5e6eb);
}

.browser-address {
	flex: 1;
	min-width: 160px;
}

.browser-webview {
	flex: 1;
	height: 0;
	width: 100%;
	min-height: 0;
	min-width: 0;
	border: 0;
}

.browser-state {
	display: grid;
	flex: 1;
	place-items: center;
}

.browser-error {
	padding: 24px;
}

.loading-indicator {
	position: absolute;
	top: 56px;
	right: 12px;
}
</style>
