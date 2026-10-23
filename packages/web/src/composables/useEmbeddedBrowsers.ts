import { reactive } from 'vue';

// Runtime instances stay mounted until explicitly closed; never persist guest IDs.
export const embeddedBrowsers = reactive<string[]>([]);

export function openEmbeddedBrowser(uid: string) {
	if (uid && !embeddedBrowsers.includes(uid)) embeddedBrowsers.push(uid);
}

export function closeEmbeddedBrowser(uid: string) {
	const index = embeddedBrowsers.indexOf(uid);
	if (index >= 0) embeddedBrowsers.splice(index, 1);
}
