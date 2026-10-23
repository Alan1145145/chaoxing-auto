"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitAnswer = exports.isProgramAnswer = exports.resolvePlainAnswer = exports.isPlainAnswer = exports.defaultWorkTypeResolver = void 0;
/** 默认题目类型解析器 */
function defaultWorkTypeResolver(ctx) {
    function count(selector) {
        let c = 0;
        for (const option of ctx.elements.options || []) {
            if ((option === null || option === void 0 ? void 0 : option.querySelector(selector)) !== null) {
                c++;
            }
        }
        return c;
    }
    return count('[type="radio"]') === 2
        ? 'judgement'
        : count('[type="radio"]') > 2
            ? 'single'
            : count('[type="checkbox"]') > 2
                ? 'multiple'
                : count('textarea') >= 1
                    ? 'completion'
                    : undefined;
}
exports.defaultWorkTypeResolver = defaultWorkTypeResolver;
/** 判断答案是否为A-Z的文本, 并且字符序号依次递增, 并且 每个字符是否都只出现了一次 */
function isPlainAnswer(answer) {
    answer = answer.trim();
    if (answer.length > 8 || !/[A-Z]/.test(answer)) {
        return false;
    }
    const counter = {};
    let min = 0;
    for (let i = 0; i < answer.length; i++) {
        if (answer.charCodeAt(i) < min) {
            return false;
        }
        min = answer.charCodeAt(i);
        counter[min] = (counter[min] || 0) + 1;
    }
    // 判断每个字符是否都只出现了一次
    for (const key in counter) {
        if (counter[key] !== 1) {
            return false;
        }
    }
    return true;
}
exports.isPlainAnswer = isPlainAnswer;
/**
 * 判断是否为纯ABCD多选答案，但是中间存在分隔符
 * @param answer  答案
 */
function resolvePlainAnswer(answer) {
    const resolve = answer
        .trim()
        .replace(/[,，.。．、 #]/g, '')
        .trim();
    if (isPlainAnswer(resolve)) {
        return resolve;
    }
}
exports.resolvePlainAnswer = resolvePlainAnswer;
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
function isProgramAnswer(answer) {
    const code = (answer !== null && answer !== void 0 ? answer : '').trim();
    if (!code)
        return false;
    // 不含 ; | ； 时无需取消分隔符，直接返回
    if (!/[;|；]/.test(code))
        return false;
    let score = 0;
    // 强特征：单独命中即可判定为程序
    const strong = [
        /#include\s*[<"]/,
        /#define\s+\w/,
        /#!\//,
        /\b(?:int|void|float|double|char|long|short)\s+main\s*\(/,
        /\bfunction\s+\w+\s*\(/,
        /\bdef\s+\w+\s*\(/,
        /\bpublic\s+(?:class|static|void|int|float|double|String|final)\b/,
        /\bprivate\s+(?:class|static|void|int|float|double|String|final)\b/,
        /\bprotected\s+(?:class|static|void|int|float|double|String|final)\b/,
        /\bprintf\s*\(/,
        /\bscanf\s*\(/,
        /\bcout\s*<</,
        /\bcin\s*>>/,
        /System\.out\./,
        /console\.log\s*\(/,
        /\bpackage\s+[\w.]+\s*;/,
        /\bimport\s+[\w.*]+\s*;/,
        /\bclass\s+\w+\s*\{/,
        /\bstruct\s+\w+\s*\{/
    ];
    for (const re of strong)
        if (re.test(code))
            score += 2;
    // 中等特征
    const medium = [
        /=>/,
        /->/,
        /::/,
        /\+\+/,
        /--/,
        /[+\-*/%]=/,
        /\bnew\s+\w+\s*\(/,
        /\bfor\s*\(/,
        /\bwhile\s*\(/,
        /\bif\s*\(/,
        /\bswitch\s*\(/,
        /\btypedef\s+/,
        /\b(?:int|float|double|char|void|bool|boolean|long|short|String|auto|const|let|var)\s+\w+/,
        /\bsizeof\s*\(/,
        /\bmalloc\s*\(/,
        /\bfree\s*\(/,
        /\bcout\b/,
        /\bcin\b/
    ];
    for (const re of medium)
        if (re.test(code))
            score += 1;
    // 结构特征：花括号块
    if (/\{/.test(code) && /\}/.test(code))
        score += 1;
    // 语句终止符 ; 至少 1 个
    if (/;/.test(code))
        score += 1;
    return score >= 2;
}
exports.isProgramAnswer = isProgramAnswer;
/** 分割答案 */
function splitAnswer(answer, separators = ['===', '#', '---', '###', '|', ';', '；']) {
    answer = answer.trim();
    if (answer.length === 0) {
        return [];
    }
    separators = separators.length === 0 ? ['===', '#', '---', '###', '|', ';', '；'] : separators;
    separators = separators.filter((el) => el.trim().length > 0);
    // 程序题答案：; | ； 是代码语法而非答案分隔符，检测到程序时取消这些分隔符
    if (isProgramAnswer(answer)) {
        separators = separators.filter((el) => el !== ';' && el !== '|' && el !== '；');
    }
    try {
        // 如果是 json 格式的多选答案
        const json = JSON.parse(answer);
        if (Array.isArray(json)) {
            return json
                .map(String)
                .map((el) => el.trim())
                .filter((el) => el.length > 0);
        }
    }
    catch (_a) {
        for (const sep of separators) {
            if (answer.split(sep).length > 1) {
                return answer
                    .split(sep)
                    .map((el) => el.trim())
                    .filter((el) => el.length > 0);
            }
        }
    }
    return [answer];
}
exports.splitAnswer = splitAnswer;
