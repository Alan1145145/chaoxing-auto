import { ref } from 'vue';
import type { AppUpdateState } from '@ocs-desktop/app';
import { remote } from '../utils/remote';

export const appUpdateVisible = ref(false);
export const appUpdateState = ref<AppUpdateState>({ phase: 'idle', currentVersion: '', percent: 0, transferred: 0, total: 0 });
export async function openAppUpdate() {
	appUpdateVisible.value = true;
	appUpdateState.value = await remote.methods.call('getAppUpdateState');
	if (['idle', 'current', 'error'].includes(appUpdateState.value.phase) && !appUpdateState.value.version) {
		appUpdateState.value = await remote.methods.call('checkForAppUpdates');
	}
}
