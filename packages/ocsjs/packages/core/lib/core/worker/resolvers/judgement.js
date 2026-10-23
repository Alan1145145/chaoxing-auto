"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJudgementOptions = exports.resolveJudgement = void 0;
const string_1 = require("../../utils/string");
const CORRECT_WORDS = ['是', '对', '正确', '确定', '√', '对的', '是的', '正确的', 'true', 'True', 'T', 'yes', '1'];
const INCORRECT_WORDS = [
    '非',
    '否',
    '错',
    '错误',
    '×',
    'X',
    '错的',
    '不对',
    '不正确的',
    '不正确',
    '不是',
    '不是的',
    'false',
    'False',
    'F',
    'no',
    '0'
];
/**
 * 判断题匹配算法
 *
 * 遍历题库答案，判断答案文本是否包含正确/错误关键词，
 * 然后在选项中匹配对应关键词的选项。
 *
 * @param answerGroups  每个题库的答案列表
 * @param options        选项文本列表
 */
function resolveJudgement(answerGroups, options) {
    for (const answers of answerGroups) {
        const answerShowCorrect = answers.find((a) => matches(a, CORRECT_WORDS));
        const answerShowIncorrect = answers.find((a) => matches(a, INCORRECT_WORDS));
        if (answerShowCorrect || answerShowIncorrect) {
            for (const option of options) {
                const textShowCorrect = matches(option, CORRECT_WORDS);
                const textShowIncorrect = matches(option, INCORRECT_WORDS);
                if (answerShowCorrect && textShowCorrect) {
                    return { finish: true, option };
                }
                if (answerShowIncorrect && textShowIncorrect) {
                    return { finish: true, option };
                }
            }
            return { finish: false };
        }
    }
    return { finish: false };
}
exports.resolveJudgement = resolveJudgement;
function matches(target, words) {
    return words.some((word) => (0, string_1.clearString)((0, string_1.removeRedundant)(word), '√', '×') === (0, string_1.clearString)((0, string_1.removeRedundant)(target), '√', '×'));
}
/** 检测选项是否为判断题性质（仅有两个选项，且分别为"对"和"错"性质） */
function isJudgementOptions(options) {
    if (options.length !== 2)
        return false;
    const hasCorrect = options.some((opt) => matches(opt, CORRECT_WORDS));
    const hasIncorrect = options.some((opt) => matches(opt, INCORRECT_WORDS));
    return hasCorrect && hasIncorrect;
}
exports.isJudgementOptions = isJudgementOptions;
