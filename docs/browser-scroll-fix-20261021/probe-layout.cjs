// Layout probe using production CSS and a real Electron webview, no account data.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../../packages/app/public');
app.setPath('userData', path.join(__dirname, 'probe-profile'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { webviewTag: true, nodeIntegration: false, contextIsolation: true } });
  try {
    const assets = path.join(root, 'assets');
    const css = fs.readdirSync(assets).filter(n => /^(index|@arco-design).*\.css$/.test(n)).map(n => fs.readFileSync(path.join(assets, n), 'utf8')).join('\n');
    const attrs = [...new Set(css.match(/data-v-[a-f\d]+/g))].join(' ');
    const html = `<html><head><style>${css}</style></head><body><div id="app"><div class="desktop-shell w-100 h-100"><div id="title" style="height:32px">Title</div><div class="main-container w-100"><nav class="app-navigation" style="width:90px;flex-shrink:0">Navigation</nav><div class="workspace-main"><header class="workspace-header">Header</header><div class="embedded-workspace"><div class="session-tabs">Session tab</div><div class="embedded-browser-page workspace-guest"><div class="browser-toolbar">Address bar</div><webview class="browser-webview" src="data:text/html,%3Cbody%20style='height:6000px;margin:0'%3ECourse%20content%3C/body%3E"></webview></div></div></div></div></div></div></body></html>`.replace(/<(div|nav|header|webview)(\s)/g, `<$1 ${attrs}$2`);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await win.webContents.executeJavaScript(`new Promise(resolve => { const guest = document.querySelector('webview'); if (guest.getWebContentsId()) resolve(); else guest.addEventListener('dom-ready', resolve, {once:true}); })`);
    for (const [width, height] of [[1280, 900], [700, 500]]) {
      win.setContentSize(width, height);
      const result = await win.webContents.executeJavaScript(`(async () => {
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const guest = document.querySelector('webview');
        const before = guest.getBoundingClientRect().top;
        window.scrollTo(0, 500);
        await guest.executeJavaScript('window.scrollTo(0, 700)');
        return { outerScroll: window.scrollY, guestScroll: await guest.executeJavaScript('window.scrollY'), before, after: guest.getBoundingClientRect().top, bottom: guest.getBoundingClientRect().bottom, height: innerHeight, toolbar: document.querySelector('.browser-toolbar').getBoundingClientRect().height, viewport: guest.getBoundingClientRect().height };
      })()`);
      assert.equal(result.outerScroll, 0);
      assert.equal(result.guestScroll, 700);
      assert.equal(result.before, result.after);
      assert(result.bottom <= result.height && result.viewport > 100 && result.toolbar > 0);
      console.log('PASS', width, height, JSON.stringify(result));
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { win.destroy(); app.quit(); }
});
