/** 单选题匹配结果 */
export interface SingleResolveResult {
    finish: boolean;
    option?: string;
    ratings?: number[];
    allAnswer?: string[];
    options?: string[];
}
/**
 * 单选题匹配算法（自适应）
 *
 * 四阶段自动匹配，无需手动选择模式：
 * 1. 归一化精确匹配 — 去除标点/空格/全角半角差异后精确比对
 * 2. 相似匹配 — 取所有选项中相似度最高且超过阈值的那个
 * 3. 纯ABCD答案兜底
 * 4. 多片段答案适配 — 题库答案被分隔符拆成多片段时，合并为一个答案后重新调用本算法
 *
 * @param answers  所有题库返回的答案列表
 * @param options   选项文本列表
 * @param separators 答案分隔符
 */
export declare function resolveSingle(answers: string[], options: string[], separators?: string[]): SingleResolveResult;
