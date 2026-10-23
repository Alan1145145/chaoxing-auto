"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultQuestionResolver = void 0;
const resolvers_1 = require("./resolvers");
/** 默认答案题目处理器 */
function createDefaultQuestionResolver(ctx, 
/**
 * 选项文本提供器：替代 `o.innerText`。
 * 图片题等场景下 innerText 无法获取 img 的 URL，需由调用方通过 DOM 遍历提供。
 * 不传则回退到 `o.innerText`，旧调用方零影响。
 */
optionText) {
    const toText = (o, i) => (optionText ? optionText(o, i) : o.innerText);
    return {
        /**
         * 单选题处理器
         *
         * 委托给 resolveSingle 纯函数，将 DOM 元素适配为字符串
         */
        single(infos, options, handler) {
            return __awaiter(this, void 0, void 0, function* () {
                const optionTexts = options.map((o, i) => toText(o, i));
                // 选项具备判断题性质时，直接走判断题处理逻辑
                if ((0, resolvers_1.isJudgementOptions)(optionTexts.map((o) => o.trim()))) {
                    const answerGroups = infos.map((info) => info.results.map((res) => res.answer));
                    const result = (0, resolvers_1.resolveJudgement)(answerGroups, optionTexts);
                    if (result.finish && result.option !== undefined) {
                        const index = optionTexts.indexOf(result.option);
                        const opt = index !== -1 ? options[index] : options[0];
                        yield handler('judgement', result.option, opt, ctx);
                    }
                    return result;
                }
                const answers = infos.map((info) => info.results.map((res) => res.answer)).flat();
                const result = (0, resolvers_1.resolveSingle)(answers, optionTexts, ctx.answerSeparators);
                if (result.finish && result.option !== undefined) {
                    const index = optionTexts.indexOf(result.option);
                    const opt = index !== -1 ? options[index] : options[0];
                    yield handler('single', result.option, opt, ctx);
                }
                return result;
            });
        },
        /**
         * 多选题处理器
         *
         * 委托给 resolveMultiple 纯函数，将 DOM 元素适配为字符串
         */
        multiple(infos, options, handler) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const resultAnswers = infos.map((info) => info.results.map((res) => res.answer)).flat();
                const optionTexts = options.map((o, i) => toText(o, i));
                const result = (0, resolvers_1.resolveMultiple)(resultAnswers, optionTexts, ctx.answerSeparators);
                // 纯 ABCD 答案兜底走 plainOptions，普通匹配走 options
                const resolvedOptions = result.finish ? (_a = result.options) !== null && _a !== void 0 ? _a : result.plainOptions : undefined;
                if (result.finish && resolvedOptions) {
                    for (const optText of resolvedOptions) {
                        const index = optionTexts.indexOf(optText);
                        const opt = index !== -1 ? options[index] : options[0];
                        yield handler('multiple', optText, opt, ctx);
                    }
                }
                return result;
            });
        },
        /**
         * 判断题处理器
         *
         * 委托给 resolveJudgement 纯函数
         */
        judgement(infos, options, handler) {
            return __awaiter(this, void 0, void 0, function* () {
                const answerGroups = infos.map((info) => info.results.map((res) => res.answer));
                const optionTexts = options.map((o, i) => toText(o, i));
                const result = (0, resolvers_1.resolveJudgement)(answerGroups, optionTexts);
                if (result.finish && result.option !== undefined) {
                    const index = optionTexts.indexOf(result.option);
                    const opt = index !== -1 ? options[index] : options[0];
                    yield handler('judgement', result.option, opt, ctx);
                }
                return result;
            });
        },
        /**
         * 填空题处理器
         *
         * 委托给 resolveCompletion 纯函数
         */
        completion(infos, options, handler) {
            return __awaiter(this, void 0, void 0, function* () {
                const answerGroups = infos.map((info) => info.results.map((res) => res.answer));
                const result = (0, resolvers_1.resolveCompletion)(answerGroups, options.length, ctx.answerSeparators);
                if (result.finish && result.answers) {
                    for (let i = 0; i < result.answers.length; i++) {
                        yield handler('completion', result.answers[i], options[i], ctx);
                    }
                }
                return result;
            });
        }
    };
}
exports.createDefaultQuestionResolver = createDefaultQuestionResolver;
