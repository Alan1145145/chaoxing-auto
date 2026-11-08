/**
 * 延迟加载 electron 主进程模块。
 *
 * worker 线程只导入平台常量时不需要 electron，顶层 require 会让整个包在
 * worker 中不可用，因此只在真正需要 app 路径时再加载。
 */
export function getElectronApp(): typeof import('electron').app {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	return require('electron').app;
}
