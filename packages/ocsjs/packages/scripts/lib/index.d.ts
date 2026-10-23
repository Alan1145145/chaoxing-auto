import { Project } from 'easy-us';
/** 导出所有的 OCS 核心模块 */
export * from '@ocsjs/core';
/** 导出启动函数，以及全局对象 */
export { start, $elements, $store } from 'easy-us';
/** 导出本包的核心脚本工程，开发者调试的时候使用 BackgroundProject 中的注入脚本，访问脚本 window 上下文 */
export { BackgroundProject } from './projects/background';
export { CommonProject } from './projects/common';
export { ZHSProject } from './projects/zhs';
export { CXProject } from './projects/cx';
export { ZJYProject } from './projects/zjy';
export { IcveMoocProject } from './projects/icve';
export { ICourseProject } from './projects/icourse';
export { YKTProject } from './projects/yuketang';
export { createOcsQuestionBankAnswererWrapper } from './projects/common';
export { RenderScript } from './render';
export { logoSvg } from './utils/ui';
export { setAnswererConfigProvider, getAnswererConfigProvider, openAnswererConnect, waitForAnswererConfig } from './utils/answerer-connect';
export type { AnswererConfigProvider } from './utils/answerer-connect';
export declare function definedProjects(): Project[];
