// Test-only desktop bootstrap: isolated profile, local pages, no login/startup side effects.
const { app, session } = require('electron');
const path = require('path');
const appRoot = process.env.MODEL_TEST_APP_ROOT || path.resolve(__dirname, '../packages/app');
const appRequire = require('module').createRequire(path.join(appRoot, 'package.json'));
const load = (file) => appRequire(`./lib/${file}`);
app.setPath('userData', process.env.MODEL_TEST_PROFILE);
app.setAppPath(appRoot);
if (process.env.MODEL_TEST_UPDATER) app.getVersion = () => appRequire('./package.json').version;
app.disableHardwareAcceleration();
if (process.env.MODEL_TEST_PRODUCTION_FLAGS) {
	for (const flag of ['no-sandbox', 'disable-gpu', 'disable-software-rasterizer', 'disable-gpu-compositing', 'disable-gpu-rasterization', 'disable-gpu-sandbox']) app.commandLine.appendSwitch(flag);
}
app.setLoginItemSettings = () => {};

app
	.whenReady()
	.then(async () => {
		const axios = appRequire('axios');
		axios.interceptors.request.use((config) => {
			const target = new URL(config.url);
			if (['localhost', '127.0.0.1'].includes(target.hostname) && target.port === '15319') {
				target.port = '15329'; config.url = target.href;
			}
			if (!['localhost', '127.0.0.1'].includes(new URL(config.url).hostname)) {
				throw new Error('Upstream requests disabled in model integration test');
			}
			return config;
		});
		const { initStore } = load('src/tasks/init.store');
		const { store, getDecryptedRenderData } = load('src/store');
		const { startupServer } = load('src/tasks/startup.server');
		const { createWindow } = load('src/window');
		const { remoteRegister } = load('src/tasks/remote.register');
		const embedded = load('src/utils/embedded-browser');
		initStore();
		
		await startupServer(15329);
		const win = createWindow();
		remoteRegister(win);
		if (process.env.MODEL_TEST_UPDATER) {
			const { EventEmitter } = require('events');
			const fixture = new EventEmitter();
			fixture.downloads = 0; fixture.installs = [];
			fixture.checkForUpdates = async () => {
				fixture.token = { cancelled: false, cancel() { this.cancelled = true; fixture.reject?.(new Error('cancelled')); } };
				fixture.emit('update-available', { version: '9.9.9', releaseNotes: '本地更新测试：保留设置。' });
				return { cancellationToken: fixture.token };
			};
			fixture.downloadUpdate = async () => {
				fixture.downloads++;
				fixture.emit('download-progress', { percent: 50, transferred: 1024, total: 2048 });
				await new Promise((resolve, reject) => { fixture.complete = resolve; fixture.reject = reject; });
				fixture.emit('update-downloaded', { version: '9.9.9' }); return ['never-executed.exe'];
			};
			fixture.quitAndInstall = (...args) => fixture.installs.push(args);
			globalThis.__updateFixture = fixture;
			load('src/tasks/updater').initializeUpdater(win, { driver: fixture });
		}
		await win.loadFile(path.join(appRoot, 'public/index.html'));
		win.show();
		globalThis.__modelTest = {
			modules: { bank: load('src/services/question-bank'), storage: load('src/utils/embedded-storage'), axios, embedded },
			messages: [],
			configState() {
				const settings = load('src/services/question-bank').getQuestionBankConfig();
				return {
					provider: settings.providers.find((item) => item.name === '自动同步测试模型'),
					selectedId: settings.selectedProviderId,
					config: getDecryptedRenderData(store).setting.ocs
				};
			},
			async openCourse() {
				const uid = 'model-sync-fixture';
				await embedded.prepareEmbeddedBrowser(uid);
				const fixtureSession = session.fromPartition(`persist:ocs-${uid}`);
				fixtureSession.protocol.handle('https', (request) => {
					if (!['study.chaoxing.com', 'mooc.chaoxing.com'].includes(new URL(request.url).hostname)) return new Response('', { status: 404 });
					const frame = request.url.includes('fixture-frame');
					return new Response(
						`<!doctype html><html><head><title>Local sync fixture</title></head><body>
					<h1>${frame ? 'Course frame' : 'Course top'}</h1>
					${frame ? '' : '<iframe src="https://study.chaoxing.com/fixture-frame"></iframe>'}
					</body></html>`,
						{ headers: { 'Content-Type': 'text/html;charset=utf-8' } }
					);
				});
				const attached = new Promise((resolve) =>
					win.webContents.once('did-attach-webview', (_event, contents) => resolve(contents))
				);
				await win.webContents.executeJavaScript(`(() => {
					const view = document.createElement('webview');
					view.partition = 'persist:ocs-model-sync-fixture';
					view.style.cssText = 'position:fixed;left:-2000px;width:900px;height:600px';
					view.src = 'about:blank';
					document.body.appendChild(view);
				})()`);
				const course = { webContents: await attached };
				this.course = course;
				course.webContents.on('console-message', (_event, level, message, line, source) => {
					if (level >= 2) this.messages.push({ level, message, line, source });
				});
				embedded.registerEmbeddedWebContents(uid, course.webContents.id);
				await embedded.syncEmbeddedOcsjs(uid, true);
				await course.webContents.loadURL('https://study.chaoxing.com/fixture');
			},
			async courseState() {
				return this.course.webContents.executeJavaScript(`(() => {
				const read = (win) => ({
					ready: typeof win.GM_getValue === 'function',
					wrappers: win.GM_getValue?.('common.settings.answererWrappers', []),
					status: win.GM_getValue?.('background.app.sync_status', ''),
					closeSync: win.GM_getValue?.('background.app.closeSync', false),
					url: win.location.href,
					lifecycle: win.document.readyState,
					cfg: win.OCS?.BackgroundProject.scripts.appConfigSync.cfg.sync_status,
					probe: win.GM_getValue?.('common.settings.modelSyncProbe', ''),
					timeOrigin: win.performance.timeOrigin
				});
				return { top: read(window), frame: window.frames.length ? read(window.frames[0]) : null };
			})()`);
			},
			store
		};
	})
	.catch((error) => {
		console.error(error);
		app.exit(1);
	});
