import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__ocsGMStorage', {
	call(action: string, key: string, value?: unknown) {
		const response = ipcRenderer.sendSync('ocs-embedded-storage', action, key, value);
		if (response?.error) throw new Error(response.error);
		return response?.value;
	}
});
