/** 填空题匹配结果 */
export interface CompletionResolveResult {
    finish: boolean;
    answers?: string[];
}
/**
 * 填空题匹配算法
 *
 * 遍历题库答案，找到答案数量与填空框数量一致的答案组，
 * 或者填空框只有一个时将所有答案合并。
 *
 * @param answerGroups  每个题库的答案列表
 * @param blankCount    填空框数量
 * @param separators    答案分隔符
 */
export declare function resolveCompletion(answerGroups: string[][], blankCount: number, separators?: string[]): CompletionResolveResult;
