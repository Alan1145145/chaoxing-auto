// Rasterize the editable SVG in Chromium; Pillow writes the multiresolution ICO.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  try {
    const dest = path.resolve(__dirname, '../packages/web/public');
    const svg = fs.readFileSync(path.join(dest, 'ai-study-icon.svg'), 'utf8');
    await win.loadURL('data:text/html,<html><body></body></html>');
    const png = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
        canvas.getContext('2d').drawImage(image, 0, 0, 1024, 1024);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }; image.onerror = reject; image.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))};
    })`);
    fs.writeFileSync(path.join(dest, 'favicon.png'), Buffer.from(png, 'base64'));
    execFileSync(process.env.PYTHON || 'python', ['-c',
      'from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])',
      path.join(dest, 'favicon.png'), path.join(dest, 'favicon.ico')], { windowsHide: true });
    console.log('Icon exported: 1024×1024 PNG and seven ICO sizes.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { win.destroy(); app.quit(); }
});
