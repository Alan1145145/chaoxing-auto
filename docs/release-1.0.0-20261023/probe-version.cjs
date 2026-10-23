// Attach to a running instance (remote debugging port) and read the version shown on the About page.
const port = Number(process.argv[2] || 9344);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	let page;
	for (let i = 0; i < 120 && !page; i++) {
		await sleep(1000);
		try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page' && /index\.html/.test(t.url)); } catch {}
	}
	if (!page) { console.log('NO_PAGE'); process.exit(2); }
	await sleep(8000);
	const ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((r) => (ws.onopen = r));
	const expr = `(async () => {
		const sleep = (ms) => new Promise(r => setTimeout(r, ms));
		const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router;
		await router.push('/about');
		let v = '';
		for (let i = 0; i < 40 && !v; i++) { await sleep(500); const el = [...document.querySelectorAll('*')].find(e => e.children.length <= 1 && /^\\s*版本\\s+[0-9]/.test(e.textContent || '')); if (el) v = el.textContent.trim(); }
		return JSON.stringify({ route: location.hash, versionText: v.slice(0, 80), updatePopup: /检测到版本更新|确认更新/.test(document.body.innerText) });
	})()`;
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) { console.log('VERSION', d.result?.result?.value || JSON.stringify(d)); process.exit(0); } };
	ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
})();
