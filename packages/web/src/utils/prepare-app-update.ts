import { nextTick } from 'vue';
import { root } from '../fs/folder';
import { Browser } from '../fs/browser';
import { embeddedBrowsers, closeEmbeddedBrowser } from '../composables/useEmbeddedBrowsers';
import { processes } from './process';
import { store } from '../store';
import { remote } from './remote';

/** Update consent already covers closing courses; never invoke the normal forced-exit timer. */
export async function prepareAppUpdate() {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			Promise.all([...processes].filter((process) => process.status !== 'closed').map((process) => process.close())),
			new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('关闭外部浏览器超时')), 12_000); })
		]);
	} finally { if (timeout) clearTimeout(timeout); }
	for (const uid of [...embeddedBrowsers]) {
		const browser = Browser.from(uid);
		if (browser) await browser.close();
		else closeEmbeddedBrowser(uid);
	}
	await nextTick();
	store.render.browser.root = JSON.parse(JSON.stringify(root()));
	const encrypt = await remote.methods.call('isEncryptionAvailable');
	await remote.methods.call('saveStore', JSON.stringify(store), encrypt);
}
