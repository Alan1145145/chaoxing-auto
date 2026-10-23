import { Rating } from 'string-similarity';
/**
 * 删除特殊字符, 并且全部转小写，只保留英文，数字，中文
 * @param str
 * @returns
 */
export declare function clearString(str: string, ...exclude: string[]): string;
/**
 * 归一化字符串：去除标点、空格、全角转半角后再 clearString
 * 用于精确匹配前预处理，忽略空白和标点差异
 */
export declare function normalizeString(str: string): string;
/**
 * 归一化精确匹配模式
 * 对答案和选项进行归一化处理后精确比对
 * 解决"多一个标点符号就匹配不上"的问题
 *
 * 方向说明（与 resolveMultiple 保持一致）：仅取"答案⊇选项"或相等，不取"选项⊇答案"，
 * 避免 "TCP" 误选 "TCP/IP协议"、"相对论" 误选 "爱因斯坦的相对论" 等语义不一致的选项。
 */
export declare function answerNormalizedMatch(answers: string[], options: string[]): string[];
/**
 * 答案相似度匹配 , 返回相似度对象列表 Array<{@link Rating}>
 *
 * 相似度计算算法 : https://www.npmjs.com/package/string-similarity
 *
 * @param answers 答案列表
 * @param options 选项列表
 *
 *
 * @example
 *
 * ```js
 *
 * answerSimilar( ['3'], ['1+2','3','4','错误的选项'] ) // [0, 1, 0, 0]
 *
 * answerSimilar( ['hello world','console.log("hello world")'], ['console.log("hello world")','hello world','1','错误的选项'] ) // [1, 1, 0, 0]
 *
 * ```
 *
 */
export declare function answerSimilar(answers: string[], options: string[]): Rating[];
/** 带领先度的相似度评分 */
export interface MatchRating extends Rating {
    /** 最高分选项与次高分选项的相似度差距（领先度），仅最高分选项有值，其余为 0 */
    gap: number;
}
/**
 * 带领先度消歧的相似度匹配
 * 返回每个选项的相似度 + 与次优选项的领先度
 * 用于解决"相似选项全选"的问题
 */
export declare function answerSimilarWithGap(answers: string[], options: string[]): MatchRating[];
/**
 * 	精准匹配模式，返回符合的选项字符串列表
 * @param answers	答案列表
 * @param options	选项列表
 */
export declare function answerExactMatch(answers: string[], options: string[]): string[];
/**
 * 删除题目选项中开头的冗余字符串
 *
 * 两条规则依次执行：
 * 1. `A.` / `A、` / `A)` 等带分隔符的选项标签：字母 + 分隔符 + 内容
 * 2. `A选项` / `C男女平等` 等字母直接紧跟中文的标签：字母 + 中文内容
 *    （仅当字母后紧跟中文时剥离，故 "TCP协议"、"CPU" 等字母串不被误删）
 */
export declare function removeRedundant(str: string): string;
