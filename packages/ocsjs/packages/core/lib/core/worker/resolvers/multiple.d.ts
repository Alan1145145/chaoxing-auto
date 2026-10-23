/** 多选题单个题库结果的匹配数据 */
export interface MultipleMatchGroup {
    options: string[];
    answers: string[];
    ratings: number[];
    similarSum: number;
    similarCount: number;
}
/** 多选题匹配结果 */
export interface MultipleResolveResult {
    finish: boolean;
    options?: string[];
    plainOptions?: string[];
    groups?: MultipleMatchGroup[];
}
/**
 * 多选题匹配算法（自适应）
 *
 * 两阶段自动匹配，无需手动选择模式：
 * 1. 归一化匹配（单向 答案⊇选项）— 去除标点/空格差异后，仅当答案包含选项（或相等）才视为命中；
 *    不取"选项包含答案"方向，避免 "TCP" 误选 "TCP/IP协议" 等语义不一致的选项
 * 2. 相似匹配 + 领先度消歧 — 候选选项两两比较，文本相似时只保留匹配度更高的
 * 3. 纯ABCD答案兜底
 *
 * @param resultAnswers  每个题库结果的原始答案字符串列表
 * @param options         选项文本列表
 * @param separators      答案分隔符
 */
export declare function resolveMultiple(resultAnswers: string[], options: string[], separators?: string[]): MultipleResolveResult;
/**
 * 领先度消歧：候选选项两两比较文本相似度，如果非常相似则只保留与答案匹配度更高的
 * 解决多选题"一字之差的选项全选"问题
 *
 * 示例：
 *   选项A "计算机网络" rating=1.0，选项B "计算机网络原理" rating=0.8
 *   二者文本相似度 > 0.6 → 只保留 rating 更高的 A
 */
export declare function disambiguateSimilarOptions(options: string[], ratings: number[], threshold?: number): string[];
