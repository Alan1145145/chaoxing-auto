import { SimplifyWorkResult, WorkerEvents, WorkResult, AnswererWrapper, SearchInformation, WorkContext } from '@ocsjs/core';
import { Script, CommonEventEmitter } from 'easy-us';
import { CommonWorkOptions } from '.';
import { buildAnswererEnv, createImageSuggestion, imageToBase64, ImageSuggestionResult, isAnswererWrappersSupportImageOptimize } from './answerer-env';
export { buildAnswererEnv, createImageSuggestion, imageToBase64, isAnswererWrappersSupportImageOptimize };
export type { ImageSuggestionResult };
/**
 * 通用作业考试工具方法
 */
export declare function commonWork(script: Script, options: {
    start_delay_seconds?: number;
    workerProvider: (opts: CommonWorkOptions) => CommonEventEmitter<WorkerEvents> | undefined;
    beforeRunning?: () => void | Promise<void>;
    onRestart?: () => void | Promise<void>;
    onWorkerCreated?: (worker: CommonEventEmitter<WorkerEvents>) => void | Promise<void>;
}): void;
/**
 * 动态答题器提示（一题一题动态作答的作业/考试）：
 * 常驻提示用户在答题过程中不要手动切换题目，防止答题与搜索结果错乱；
 * worker 完成（done）或被关闭（close）时自动移除。
 */
export declare function dynamicWorkTips(worker: CommonEventEmitter<WorkerEvents>): void;
/**
 * 答题控制
 */
export declare function createWorkerControl(options: {
    workerProvider: () => CommonEventEmitter<WorkerEvents> | undefined;
    onStart: () => void;
    onRestart: () => void;
    /** 暂停状态（外部托管）：面板重建后按钮状态与 worker 实际状态保持一致；不传则为内部状态 */
    paused?: {
        value: boolean;
    };
}): {
    startBtn: HTMLInputElement;
    restartBtn: HTMLInputElement;
    controlBtn: HTMLInputElement;
};
/**
 * 结构化 DOM 遍历：提取文本与图片 URL。
 *
 * 替代旧的 `optimizationElementWithImage(...).innerText` 链路：
 * - 不改造 DOM、不读 innerText、不用正则。
 * - `text` 产出原始 URL 文本（URL 两侧加空格分隔，避免相邻 URL 拼接）。
 * - `images` 额外返回按文档顺序的 URL 数组，供 createImageSuggestion 跳过正则。
 * - 跳过 `display:none` 的元素（模拟 innerText 对非渲染节点的跳过）。
 * - 对 detached 元素（如 zhs 由 JSON HTML 构建的 div）同样适用。
 */
export interface ExtractTextOptions {
    /** 仅收集满足条件的 img（如 zhs 选项需排除按钮图片） */
    imgFilter?: (img: HTMLImageElement) => boolean;
}
export declare function extractTextWithImages(root: HTMLElement, opts?: ExtractTextOptions): {
    text: string;
    images: string[];
};
/** 将 {@link WorkResult} 转换成 {@link SimplifyWorkResult} */
export declare function simplifyWorkResult(results: WorkResult<any>[], 
/**
 * 标题处理方法
 * 在答题时使用相同的处理方法，可以使答题结果显示的题目与搜题的题目保持一致
 */
titleTransform?: (title: (HTMLElement | undefined)[], index: number) => string): SimplifyWorkResult[];
/**
 * 动态答题器结果 upsert：检测到题目即在结果面板占位（等待搜索中），
 * 随后每次状态推进（等待答题中→已答题/失败）原地更新。
 * 供动态流程（一题一题加载）的 onQuestionDetected 与 onResultsUpdate 共同调用，
 * 解决全部流程结束后才显示结果、用户对过程无感知的问题。
 */
export declare function updateDynamicResult(current: WorkResult<any>, titleTransform?: (title: (HTMLElement | undefined)[], index: number) => string): Promise<any>;
/**
 * 从题目中移除指定的冗余词
 */
export declare function removeRedundantWords(str: string, words: string[]): string;
export declare const answerWrapperEmptyWarning: (duration: number) => Promise<void>;
export declare const closeAnswerWrapperEmptyWarning: () => Promise<void>;
/**
 * 创建通用的 answerer 回调，封装搜题缓存、延迟、env 构建、AI 图片建议等公共逻辑
 * @param options.titleTransform 标题转换函数，接收 (elements, ctx)，返回字符串标题
 * @param options.optionsTransform 选项转换函数（可选），接收 (elements, ctx)，返回选项文本字符串；
 *   默认取 ctx.elements.options 的 innerText 拼接
 * @param options.answererWrappers 题库配置
 * @param options.period 搜题间隔（秒），默认 3
 */
export declare function createCommonAnswerer(options: {
    titleTransform: (elements: any, ctx: WorkContext<any>) => string | {
        text: string;
        images?: string[];
    };
    optionsTransform?: (elements: any, ctx: WorkContext<any>) => string | {
        text: string;
        images?: string[];
    };
    answererWrappers: AnswererWrapper[];
    period?: number;
}): (elements: any, ctx: WorkContext<any>) => Promise<SearchInformation[]>;
