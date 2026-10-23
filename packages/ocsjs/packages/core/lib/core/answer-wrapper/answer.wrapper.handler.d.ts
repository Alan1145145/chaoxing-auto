import { AnswererWrapper, SearchInformation } from './interface';
export declare const AnswerWrapperHandlerConfig: {
    timeout_seconds: number;
};
/**
 *
 * 默认题库配置解析器
 *
 * @example
 *
 * ```js
 *
 * // 假设有一个接口 : https://example.com/search?title=1+2,2+3
 * // 此接口返回 {code: 1, data: { answers: [3 , 5] , title:'1+2' }, msg:'成功'}
 *
 * defaultAnswerWrapperHandler({
 *      titleElements: Array.from(document.querySelector('.title'))
 * },
 * [
 *  // 可以有多个构造器，最终通过 answerPath 一起合并到一个列表并返回
 *  {
 *      url: 'https://example.com/search',
 *      method: 'get',
 *      answerPath: 'data.answers',
 *      data:{
 *          title: 'titleElements[0]' // 1+2,2+3
 *      }
 *  }
 * ]) // [3 , 5]
 *
 *
 * ```
 *
 * @param elements 题目元素
 * @param answererWrappers 题库配置器数组
 * @returns
 */
export declare function defaultAnswerWrapperHandler(answererWrappers: AnswererWrapper[], env: {
    title?: string;
    options?: string;
    type?: string;
    /**
     * 图片题优化：base64 图片数组（顺序对应 [图片1]、[图片2]…）。
     * 仅在开启图片题优化且题目/选项含图片时由 buildAnswererEnv 注入。
     */
    images?: string[];
    /**
     * 图片题优化：原题标题中图片 URL 替换为 [图片N] 占位符后的文本。
     * 未注入时默认为空字符串。
     */
    suggestion_title?: string;
    /**
     * 图片题优化：原选项中图片 URL 替换为 [图片N] 占位符后的文本。
     * 未注入时默认为空字符串。
     */
    suggestion_options?: string;
    [x: string]: any;
}): Promise<SearchInformation[]>;
