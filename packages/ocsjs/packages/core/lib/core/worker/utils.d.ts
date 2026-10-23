import { QuestionTypes, WorkContext } from './interface';
/** 默认题目类型解析器 */
export declare function defaultWorkTypeResolver(ctx: WorkContext<any>): QuestionTypes | undefined;
/** 判断答案是否为A-Z的文本, 并且字符序号依次递增, 并且 每个字符是否都只出现了一次 */
export declare function isPlainAnswer(answer: string): boolean;
/**
 * 判断是否为纯ABCD多选答案，但是中间存在分隔符
 * @param answer  答案
 */
export declare function resolvePlainAnswer(answer: string): string | undefined;
/**
 * 检测答案是否为一段程序代码
 *
 * 程序题的题库答案是一段代码，其中的 `;` `|` `；` 是代码语法（语句终止符、按位或运算符），
 * 而非答案分隔符。本函数通过代码关键字、运算符、语句终止符等特征综合判定，
 * 命中则在 {@link splitAnswer} 中取消 `;` `|` `；` 作为分隔符，避免代码被错误拆分。
 *
 * 仅当答案中存在 `;` `|` `；` 时才需要判定（否则无需取消任何分隔符），以此降低误判。
 *
 * @param answer 答案文本
 */
export declare function isProgramAnswer(answer: string): boolean;
/** 分割答案 */
export declare function splitAnswer(answer: string, separators?: string[]): string[];
