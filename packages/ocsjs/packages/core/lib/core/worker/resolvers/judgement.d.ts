/** 判断题匹配结果 */
export interface JudgementResolveResult {
    finish: boolean;
    option?: string;
}
/**
 * 判断题匹配算法
 *
 * 遍历题库答案，判断答案文本是否包含正确/错误关键词，
 * 然后在选项中匹配对应关键词的选项。
 *
 * @param answerGroups  每个题库的答案列表
 * @param options        选项文本列表
 */
export declare function resolveJudgement(answerGroups: string[][], options: string[]): JudgementResolveResult;
/** 检测选项是否为判断题性质（仅有两个选项，且分别为"对"和"错"性质） */
export declare function isJudgementOptions(options: string[]): boolean;
