import { AnswererWrapper, WorkUploadType } from '@ocsjs/core';
import { MessageElement } from 'easy-us';
import { MessageAttrs } from 'easy-us/lib/interfaces/custom-window';
export interface CommonWorkOptions {
    period: number;
    thread: number;
    upload: WorkUploadType;
    answererWrappers: AnswererWrapper[];
    stopSecondWhenFinish: number;
    redundanceWordsText: string;
    answerSeparators: string;
}
/** 创建答题预处理信息 */
export declare function workPreCheckMessage(options: CommonWorkOptions & {
    start_delay_seconds?: number;
    onrun: (opts: CommonWorkOptions) => void;
    /**
     * 当没有题库配置时的回调
     */
    onNoAnswererWrappers?: (opts: CommonWorkOptions) => void;
    /**
     * 手动关闭时的回调
     */
    onclose?: (opts: CommonWorkOptions, closedMessage: MessageElement) => void;
}): Promise<void> | MessageElement | undefined;
/**
 * 创造范围选择器的提示
 */
export declare function createRangeTooltip(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, defaultValue: string, transform: (val: string) => string): void;
export declare function playMedia(playFunction: () => Promise<void> | undefined | void): Promise<boolean>;
/**
 * 	解除复制限制功能
 * @param elements 要开启复制功能的元素
 */
export declare function enableCopy(elements: (HTMLElement | Document)[]): void;
/**
 * 创建关于问题题目的拓展功能按钮，包括复制和百度一下
 * @param question 问题
 */
/**
 * 题目区域的额外操作行（右对齐，按钮统一为项目通用按钮样式）。
 * @param question 题目文本（复制/搜索用）
 * @param left 需要放在"复制"按钮左侧的元素（如题型标签），避免独占一行高度
 */
export declare function createQuestionTitleExtra(question: string, ...left: HTMLElement[]): HTMLDivElement;
export declare const $msg: {
    /**  输出气泡消息以及日志记录  */
    info: (attrs: MessageAttrs) => void;
    /**  输出气泡消息以及日志记录  */
    warn: (attrs: MessageAttrs) => void;
    /**  输出气泡消息以及日志记录  */
    error: (attrs: MessageAttrs) => void;
    /**  输出气泡消息以及日志记录  */
    success: (attrs: MessageAttrs) => void;
};
