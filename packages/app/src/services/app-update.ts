import type { AppUpdater, UpdateCheckResult } from 'electron-updater';
import { gt, valid } from 'semver';

export type AppUpdatePhase = 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'downloaded' | 'preparing' | 'installing' | 'error' | 'unsupported';
export type AppUpdateState = {
	phase: AppUpdatePhase;
	currentVersion: string;
	version?: string;
	releaseNotes?: string;
	percent: number;
	transferred: number;
	total: number;
	error?: string;
	errorStage?: 'check' | 'download' | 'install';
};
export type UpdateDriver = Pick<AppUpdater, 'on' | 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall'>;

/** The driver owns transport/checksum/NSIS; this controller owns user consent and state. */
export class AppUpdateController {
	private state: AppUpdateState;
	private checking?: Promise<AppUpdateState>;
	private updating?: Promise<AppUpdateState>;
	private cancellation?: UpdateCheckResult['cancellationToken'];
	private downloaded = false;
	private cancelled = false;

	constructor(private driver: UpdateDriver | undefined, version: string, private publish: (state: AppUpdateState) => void, private prepare: () => Promise<void>) {
		this.state = { phase: driver ? 'idle' : 'unsupported', currentVersion: version, percent: 0, transferred: 0, total: 0 };
		driver?.on('update-available', (info) => {
			if (!valid(info.version) || !valid(version) || !gt(info.version, version)) return;
			const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : info.releaseNotes?.map((item) => item.note).join('\n');
			this.change({ phase: 'available', version: info.version, releaseNotes: notes?.replace(/<[^>]*>/g, '').slice(0, 6000), error: undefined, errorStage: undefined });
		});
		driver?.on('update-not-available', () => this.change({ phase: 'current', version: undefined, error: undefined, errorStage: undefined }));
		driver?.on('download-progress', (progress) => {
			if (this.state.phase !== 'downloading') return;
			const positive = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
			this.change({ percent: Math.min(100, positive(progress.percent)), transferred: positive(progress.transferred), total: positive(progress.total) });
		});
		driver?.on('update-downloaded', () => {
			if (this.state.phase !== 'downloading' || this.cancelled) return;
			this.downloaded = true;
			this.change({ phase: 'downloaded', percent: 100 });
		});
		driver?.on('error', () => {
			if (!this.cancelled) this.fail(this.state.phase === 'checking' ? 'check' : this.state.phase === 'installing' ? 'install' : 'download');
		});
	}

	getState() { return { ...this.state }; }
	get installing() { return this.state.phase === 'installing'; }
	private change(patch: Partial<AppUpdateState>) { this.state = { ...this.state, ...patch }; this.publish(this.getState()); }
	private fail(stage: 'check' | 'download' | 'install') {
		const messages = { check: '检查更新失败，请检查网络后重试。', download: '下载或校验失败，未安装更新，请重试。', install: '更新准备或安装失败，请重试。' };
		this.change({ phase: 'error', errorStage: stage, error: messages[stage] });
	}

	check(): Promise<AppUpdateState> {
		if (!this.driver || this.updating || this.downloaded) return Promise.resolve(this.getState());
		if (this.checking) return this.checking;
		this.change({ phase: 'checking', error: undefined, errorStage: undefined });
		this.checking = this.driver.checkForUpdates().then((result) => {
			this.cancellation = result?.cancellationToken;
			if (this.state.phase === 'checking') this.change({ phase: 'current' });
			return this.getState();
		}).catch(() => { this.fail('check'); return this.getState(); }).finally(() => { this.checking = undefined; });
		return this.checking;
	}

	start(): Promise<AppUpdateState> {
		if (this.installing) return Promise.resolve(this.getState());
		if (this.updating) return this.updating;
		if (!this.driver || !this.state.version) return Promise.resolve(this.getState());
		this.updating = Promise.resolve().then(() => this.runUpdate()).finally(() => { this.updating = undefined; });
		return this.updating;
	}

	cancel() {
		if (this.state.phase === 'downloading' && this.cancellation) { this.cancelled = true; this.cancellation.cancel(); }
		return this.getState();
	}

	private async runUpdate() {
		const driver = this.driver!;
		try {
			if (this.checking) await this.checking;
			if (!this.downloaded) {
				// Cancellation tokens are single-use; refresh release metadata before retrying.
				if (this.cancellation?.cancelled || this.state.phase === 'error') {
					this.change({ phase: 'checking' });
					const checked = await driver.checkForUpdates();
					this.cancellation = checked?.cancellationToken;
				}
				if (this.state.phase !== 'available') return this.getState();
				this.cancelled = false;
				this.change({ phase: 'downloading', percent: 0, transferred: 0, total: 0, error: undefined, errorStage: undefined });
				await driver.downloadUpdate(this.cancellation);
				if (this.cancelled) { this.change({ phase: 'available', percent: 0 }); return this.getState(); }
				if (!this.downloaded) throw new Error('Download did not complete verification');
			}
			this.change({ phase: 'preparing', error: undefined, errorStage: undefined });
			await this.prepare();
			this.change({ phase: 'installing' });
			driver.quitAndInstall(true, true);
		} catch {
			if (this.cancelled) this.change({ phase: 'available', percent: 0 });
			else this.fail(this.downloaded ? 'install' : this.state.phase === 'checking' ? 'check' : 'download');
		}
		return this.getState();
	}
}
