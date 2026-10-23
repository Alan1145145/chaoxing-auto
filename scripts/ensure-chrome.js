const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const platformNames = {
	win32: 'win',
	darwin: 'mac',
	linux: 'linux'
};
const platform = process.env.PLATFORM || platformNames[process.platform];
const arch = process.env.ARCH || process.arch;

if (!platform) {
	console.error('[chrome] 不支持的平台:', process.platform);
	process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const archivePath = path.join(projectRoot, 'bin', 'chrome', platform + '-' + arch, 'chrome.zip');
if (fs.existsSync(archivePath) && fs.statSync(archivePath).size > 0) {
	console.log('[chrome] 内置浏览器资源已就绪:', archivePath);
	process.exit(0);
}

console.log('[chrome] 缺少内置浏览器资源，开始安装:', archivePath);
const result = spawnSync('pnpm', ['exec', 'gulp', '-f', 'scripts/chrome.install.js'], {
	cwd: projectRoot,
	stdio: 'inherit',
	shell: process.platform === 'win32'
});

if (result.error) {
	console.error('[chrome] 安装命令启动失败:', result.error.message);
	process.exit(1);
}

if (result.status !== 0 || !fs.existsSync(archivePath) || fs.statSync(archivePath).size === 0) {
	console.error('[chrome] 内置浏览器资源未能生成:', archivePath);
	process.exit(result.status || 1);
}
