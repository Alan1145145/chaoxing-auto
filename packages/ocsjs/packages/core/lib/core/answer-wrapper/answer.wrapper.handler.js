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
exports.defaultAnswerWrapperHandler = exports.AnswerWrapperHandlerConfig = void 0;
const request_1 = require("../utils/request");
const utils_1 = require("../../utils");
exports.AnswerWrapperHandlerConfig = {
    // 超时时间，单位毫秒
    timeout_seconds: 60
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
function defaultAnswerWrapperHandler(answererWrappers, 
// 上下文解析环境
env) {
    return __awaiter(this, void 0, void 0, function* () {
        const searchInfos = [];
        const temp = JSON.parse(JSON.stringify(answererWrappers));
        if (temp.length === 0) {
            throw new Error('题库配置不能为空，请配置后重新开始自动答题。');
        }
        // 上下文环境字段默认值：防止题库配置中 ${title} / ${options} / ${type} /
        // ${images} / ${suggestion_title} / ${suggestion_options} 等占位符因字段缺失
        // 被替换为 'undefined' 字面量。
        if (env.title === undefined)
            env.title = '';
        if (env.options === undefined)
            env.options = '';
        if (env.type === undefined)
            env.type = 'unknown';
        if (env.images === undefined)
            env.images = [];
        if (env.suggestion_title === undefined)
            env.suggestion_title = '';
        if (env.suggestion_options === undefined)
            env.suggestion_options = '';
        // 多线程请求
        yield Promise.all(temp.map((wrapper) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // 解构数据，并赋初始值
            const { name = '未知题库', homepage = '#', method = 'get', type = 'fetch', contentType = 'json', responseType = 'json', headers = {}, data: wrapperData = {}, handler = 'return (res)=> [JSON.stringify(res), undefined]' } = wrapper;
            // POST 请求若未显式提供 Content-Type，默认按 JSON 提交
            if (method.toLocaleLowerCase() === 'post') {
                if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
                    headers['Content-Type'] = 'application/json';
                }
            }
            try {
                // 答案列表
                let results = [];
                // 请求数据
                let requestData;
                // 请求地址
                let url;
                if (method.toLocaleLowerCase() === 'get') {
                    url = new URL(resolvePlaceHolder(wrapper.url, { encodeURI: true }));
                    /**
                     * 如果 data 存在数据并且 method 为 get，则将 data 数据拼接到 url 上，覆盖原有的  url 同名参数
                     * data 参数的优先级高于 url 参数
                     */
                    Object.keys(wrapperData).forEach((key) => {
                        // searchParams.set 方法会自动编码，所以不需要 encodeURI: true
                        url.searchParams.set(key, resolvePlaceHolder(wrapperData[key]));
                    });
                    // get 的请求数据为空
                    requestData = {};
                }
                else if (method.toLocaleLowerCase() === 'post') {
                    url = new URL(wrapper.url);
                    // 构造请求数据
                    const data = Object.create({});
                    /** 构造一个请求数据 */
                    Object.keys(wrapperData).forEach((key) => {
                        // 如果存在字段解析器
                        if (typeof wrapperData[key] === 'object' && Reflect.has(wrapperData[key], 'handler')) {
                            // eslint-disable-next-line no-new-func
                            const handler = Function(Reflect.get(wrapperData[key], 'handler'))();
                            if (typeof handler !== 'function') {
                                throw new Error('data 字段解析器必须返回一个函数');
                            }
                            const result = handler(env);
                            Reflect.set(data, key, result);
                        }
                        else {
                            // 解析data数据
                            Reflect.set(data, key, resolvePlaceHolder(wrapperData[key]));
                        }
                    });
                    requestData = data;
                }
                else {
                    throw new Error('不支持的请求方式');
                }
                // 发送请求
                const timeoutSeconds = typeof wrapper.timeout_seconds === 'number' && Number.isFinite(wrapper.timeout_seconds)
                    ? Math.max(1, Math.min(wrapper.timeout_seconds, 7200))
                    : (_a = exports.AnswerWrapperHandlerConfig.timeout_seconds) !== null && _a !== void 0 ? _a : 60;
                const responseData = yield Promise.race([
                    (0, request_1.request)(url.toString(), {
                        method,
                        // contentType: 历史遗留的命名问题
                        responseType: responseType || contentType,
                        data: requestData,
                        type,
                        headers: resolvePlaceHolder(JSON.parse(JSON.stringify(headers || {})))
                    }),
                    utils_1.$.sleep(timeoutSeconds * 1000)
                ]);
                if (responseData === undefined) {
                    throw new Error('题库请求超时，可能是题库问题，或者请检查网络或者重试。');
                }
                /** 从 handler 获取搜索到的题目和回答 */
                // eslint-disable-next-line no-new-func
                const responseHandler = Function(handler)();
                if (typeof responseHandler !== 'function') {
                    throw new Error('handler 响应处理器必须返回一个函数');
                }
                const info = responseHandler(responseData);
                if (info && Array.isArray(info)) {
                    /** 如果返回一个二维数组 */
                    if (info.every((item) => Array.isArray(item))) {
                        results = results.concat(info.map((item) => ({
                            question: item[0],
                            answer: item[1],
                            extra_data: item[2] || {}
                        })));
                    }
                    else {
                        results.push({
                            question: info[0],
                            answer: info[1],
                            extra_data: info[2] || {}
                        });
                    }
                }
                searchInfos.push({
                    url: wrapper.url,
                    name,
                    homepage,
                    results,
                    response: responseData,
                    data: requestData
                });
            }
            catch (error) {
                console.error(error);
                searchInfos.push({
                    url: wrapper.url,
                    name,
                    homepage,
                    results: [],
                    response: undefined,
                    data: undefined,
                    error: readAnswererError(error)
                });
            }
        })));
        function readAnswererError(error) {
            if (typeof error === 'string') {
                try {
                    const parsed = JSON.parse(error);
                    if (parsed && typeof parsed.message === 'string' && parsed.message.trim())
                        return parsed.message;
                }
                catch (_a) {
                    // 非 JSON 的响应正文直接展示。
                }
                return error.trim() || '题库连接失败';
            }
            const message = error === null || error === void 0 ? void 0 : error.message;
            return message && message.trim() ? message : '题库连接失败';
        }
        // 替换占位符
        function resolvePlaceHolder(data, options) {
            if (typeof data === 'string') {
                const matches = data.match(/\${(.*?)}/g) || [];
                matches.forEach((placeHolder) => {
                    /** 获取占位符的值 */
                    const raw = env[placeHolder.replace(/\${(.*)}/, '$1')];
                    const value = raw == null ? '' : raw;
                    data = data.replace(placeHolder, (options === null || options === void 0 ? void 0 : options.encodeURI) ? encodeURIComponent(value) : value);
                });
            }
            else if (typeof data === 'object') {
                // 递归替换
                const keys = Object.keys(data);
                for (const key of keys) {
                    data[key] = resolvePlaceHolder(data[key], options);
                }
            }
            return data;
        }
        return searchInfos;
    });
}
exports.defaultAnswerWrapperHandler = defaultAnswerWrapperHandler;
