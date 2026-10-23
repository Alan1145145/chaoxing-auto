// Launch a copied win-unpacked with a fresh --user-data-dir, drive the 豆包 QR login via CDP, report the result.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [exe, userData, outDir, portArg] = process.argv.slice(2);
const port = Number(portArg || 9339);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
	try { return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { return []; }
}
function cdp(wsUrl) {
	const ws = new WebSocket(wsUrl);
	let id = 0; const pending = new Map();
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
	return new Promise((resolve, reject) => {
		ws.onerror = reject;
		ws.onopen = () => resolve({
			send: (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); }),
			close: () => ws.close()
		});
	});
}
(async () => {
	if (!process.env.ATTACH) { const child = spawn(exe, [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`], {
		env: { ...process.env, __COMPAT_LAYER: 'RunAsInvoker' }, detached: true, stdio: 'ignore'
	});
	child.unref();
	console.log('spawned pid', child.pid); }
	let page;
	for (let i = 0; i < 240 && !page; i++) {
		await sleep(1000);
		const list = await targets();
		page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
		if (page) { await sleep(6000); const again = (await targets()).find((t) => t.type === 'page' && /index\.html/.test(t.url)); page = again || page; }
	}
	if (!page) { console.log('NO_PAGE'); process.exit(2); }
	console.log('page', page.title, page.url);
	const c = await cdp(page.webSocketDebuggerUrl);
	const expr = `(async () => {
		const sleep = (ms) => new Promise(r => setTimeout(r, ms));
		const out = { title: document.title };
		const nav = [...document.querySelectorAll('.app-navigation button')].find(b => b.textContent.includes('豆包助手'));
		if (nav) nav.click(); else location.hash = '#/doubao';
		for (const b of document.querySelectorAll('.arco-modal button')) { if (/下次再看|关闭/.test(b.textContent)) b.click(); }
		let btn;
		for (let i = 0; i < 40 && !btn; i++) { await sleep(500); btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('豆包 App 扫码登录')); }
		await sleep(4000);
		out.errorBanner = document.querySelector('.doubao-error')?.innerText || '';
		if (!btn) { out.result = 'NO_QR_BUTTON'; out.body = document.body.innerText.slice(0, 800); return JSON.stringify(out); }
		btn.click();
		let text = '';
		for (let i = 0; i < 60; i++) {
			await sleep(500);
			const modal = [...document.querySelectorAll('.arco-modal')].find(m => m.innerText.includes('连接豆包 · 扫码登录'));
			text = modal ? modal.innerText : '';
			const img = modal && modal.querySelector('img[src^="data:image"]');
			if (img) { out.result = 'QR_OK'; break; }
			if (/获取失败|检查失败|请求失败/.test(text)) { out.result = 'QR_FAIL'; break; }
		}
		out.modal = text.slice(0, 600);
		out.errorBanner2 = document.querySelector('.doubao-error')?.innerText || '';
		return JSON.stringify(out);
	})()`;
	const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
	console.log('RESULT', r.result?.result?.value || JSON.stringify(r.result));
	const shot = await c.send('Page.captureScreenshot', { format: 'png' });
	if (shot.result?.data) fs.writeFileSync(path.join(outDir, 'clean-probe.png'), Buffer.from(shot.result.data, 'base64'));
	c.close();
	process.exit(0);
})().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1); });
