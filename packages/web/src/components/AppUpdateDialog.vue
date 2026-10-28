<template>
	<a-modal v-model:visible="appUpdateVisible" title="软件更新" :width="520" :footer="false" :closable="!installing" :mask-closable="!busy" modal-class="app-update-modal">
		<div class="app-update-content">
			<div class="update-heading"><Icon type="system_update" :size="36" /><div><h3>{{ headline }}</h3><p>当前版本 {{ state.currentVersion || '…' }}<span v-if="state.version"> · 新版本 {{ state.version }}</span></p></div></div>
			<a-spin v-if="state.phase === 'checking'" tip="正在检查新版本…" />
			<a-alert v-if="state.phase === 'error'" type="warning">{{ state.error }}</a-alert>
			<p v-if="state.phase === 'unsupported'">此运行环境不支持自动安装，请使用 Windows 安装版。</p>
			<div v-if="state.phase === 'downloading'" aria-live="polite">
				<a-progress :percent="state.percent / 100" />
				<p>{{ megabytes(state.transferred) }} / {{ state.total ? megabytes(state.total) : '计算中' }}</p>
			</div>
			<a-spin v-if="installing" :tip="state.phase === 'preparing' ? '正在保存数据、关闭课程窗口…' : '正在安装，完成后自动重启…'" />
			<pre v-if="state.releaseNotes" class="release-notes">{{ state.releaseNotes }}</pre>
			<p v-if="state.version" class="update-note">点击更新后自动下载、校验、保存数据并安装重启。现有配置、题库和登录数据会保留。更新期间请勿关闭软件。</p>
			<div class="update-actions">
				<a-button v-if="state.phase === 'downloading'" @click="cancel">取消下载</a-button>
				<a-button v-if="!installing" @click="appUpdateVisible = false">{{ state.phase === 'downloading' ? '后台下载' : '稍后' }}</a-button>
				<a-button v-if="canUpdate" type="primary" @click="start">{{ state.phase === 'error' ? '重试更新' : '立即更新' }}</a-button>
				<a-button v-else-if="!busy && state.phase !== 'unsupported'" type="primary" @click="check">检查更新</a-button>
			</div>
		</div>
	</a-modal>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { appUpdateState as state, appUpdateVisible } from '../composables/useAppUpdate';
import { remote } from '../utils/remote';
import { electron, inBrowser } from '../utils/node';
import type { AppUpdateState } from '@ocs-desktop/app';
import Icon from './Icon.vue';

const installing = computed(() => ['preparing', 'installing'].includes(state.value.phase));
const busy = computed(() => installing.value || ['checking', 'downloading', 'downloaded'].includes(state.value.phase));
const canUpdate = computed(() => !!state.value.version && ['available', 'downloaded', 'error'].includes(state.value.phase));
const headlines: Record<AppUpdateState['phase'], string> = { idle: '检查软件更新', checking: '正在检查更新', available: '发现新版本', current: '已经是最新版本', downloading: '正在下载更新', downloaded: '更新已下载', preparing: '准备安装更新', installing: '正在更新软件', error: '更新暂未完成', unsupported: '请使用安装版更新' };
const headline = computed(() => headlines[state.value.phase]);
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
let remindedVersion = '';
function receive(_event: unknown, next: AppUpdateState) {
	state.value = next;
	if (next.phase === 'available' && next.version && next.version !== remindedVersion) {
		remindedVersion = next.version;
		appUpdateVisible.value = true;
	}
}
async function check() { state.value = await remote.methods.call('checkForAppUpdates'); }
async function start() { await remote.methods.call('startAppUpdate'); }
async function cancel() { await remote.methods.call('cancelAppUpdate'); }
onMounted(async () => {
	if (inBrowser) return;
	electron.ipcRenderer.on('app-update-state', receive);
	state.value = await remote.methods.call('getAppUpdateState');
});
onBeforeUnmount(() => { if (!inBrowser) electron.ipcRenderer.removeListener('app-update-state', receive); });
</script>
<style scoped>
.app-update-content { max-height: calc(100vh - 200px); overflow-y: auto; }
.update-heading { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.update-heading h3 { margin: 0 0 6px; color: var(--color-text-1); }
.update-heading p, .update-note { color: var(--color-text-2); line-height: 1.8; font-size: 13px; }
.release-notes { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; padding: 14px; background: var(--color-fill-1); border-radius: 10px; max-height: 220px; overflow-y: auto; }
.update-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
</style>
