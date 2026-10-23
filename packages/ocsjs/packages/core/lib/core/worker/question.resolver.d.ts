import { QuestionResolver, WorkContext } from './interface';
/** 默认答案题目处理器 */
export declare function createDefaultQuestionResolver<E>(ctx: WorkContext<E>, 
/**
 * 选项文本提供器：替代 `o.innerText`。
 * 图片题等场景下 innerText 无法获取 img 的 URL，需由调用方通过 DOM 遍历提供。
 * 不传则回退到 `o.innerText`，旧调用方零影响。
 */
optionText?: (el: HTMLElement, i: number) => string): Record<'single' | 'multiple' | 'completion' | 'judgement', QuestionResolver<E>>;
