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
exports.CustomOCSWorker = exports.OCSWorker = void 0;
const easy_us_1 = require("easy-us");
const dom_1 = require("../utils/dom");
const question_resolver_1 = require("./question.resolver");
const utils_1 = require("./utils");
const answer_wrapper_1 = require("../answer-wrapper");
/**
 * 自动答题器， 传入一些指定的配置， 就可以进行自动答题。
 *
 * @param work      工作器, 传入一个方法可自定义工作器，或者使用默认的工作器，详情： {@link WorkOptions.work}
 * @param answerer  查题器, : 默认是 {@link defaultAnswerWrapperHandler}
 *
 */
class OCSWorker extends easy_us_1.CommonEventEmitter {
    constructor(opts) {
        super();
        this.isRunning = false;
        this.isClose = false;
        this.isStop = false;
        this.totalQuestionCount = 0;
        this.opts = opts;
    }
    /**
     * 启动元素观察器（幂等）：root 元素从界面消失时自动关闭答题。
     *
     * 场景：location.hash 更新 / SPA 页面切换后，脚本沙盒不会被重置，
     * 答题程序仍在运行但操作的是已脱离文档的旧元素，此时必须自动关闭。
     *
     * 判定方式（间隔轮询）：
     * - root 为字符串选择器：document.querySelector(root) 是否存在
     * - root 为元素数组：每次检测重新读取数组内容（支持消费方原地刷新数组），
     *   任一元素 isConnected 即视为存活
     * 持续消失超过 lostTimeoutMs 才判定丢失，防止框架重渲染/正常切题时
     * 元素瞬时脱离文档导致的误判。
     */
    startRootObserver() {
        var _a, _b;
        const cfg = this.opts.rootObserver;
        if (!(cfg === null || cfg === void 0 ? void 0 : cfg.enabled) || this.rootObserverTimer !== undefined) {
            return;
        }
        const interval = (_a = cfg.checkIntervalMs) !== null && _a !== void 0 ? _a : 1000;
        const lostTimeout = (_b = cfg.lostTimeoutMs) !== null && _b !== void 0 ? _b : 1000;
        this.rootObserverTimer = setInterval(() => {
            var _a, _b;
            if (this.isClose) {
                this.stopRootObserver();
                return;
            }
            const alive = typeof this.opts.root === 'string'
                ? !!document.querySelector(this.opts.root)
                : this.opts.root.some((el) => el.isConnected);
            if (alive) {
                this.rootLostSince = undefined;
                return;
            }
            (_a = this.rootLostSince) !== null && _a !== void 0 ? _a : (this.rootLostSince = Date.now());
            if (Date.now() - this.rootLostSince >= lostTimeout) {
                this.stopRootObserver();
                (_b = cfg.onRootLost) === null || _b === void 0 ? void 0 : _b.call(cfg);
                if (!this.isClose) {
                    easy_us_1.$message.warn({
                        content: '⚠️ 题目元素已从页面消失（页面可能已跳转或刷新），答题程序已自动关闭。',
                        duration: 0
                    });
                }
                this.emit('close');
            }
        }, interval);
    }
    /** 停止元素观察器 */
    stopRootObserver() {
        if (this.rootObserverTimer !== undefined) {
            clearInterval(this.rootObserverTimer);
            this.rootObserverTimer = undefined;
        }
        this.rootLostSince = undefined;
    }
    /** 启动答题器  */
    doWork(options) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('start');
            this.isRunning = true;
            this.once('close', () => {
                this.isClose = true;
                this.stopRootObserver();
            });
            // 启动元素观察器：root 消失时自动关闭（幂等，重复 doWork 不会重复创建）
            this.startRootObserver();
            this.on('stop', () => {
                this.isStop = true;
            });
            this.on('continuate', () => {
                this.isStop = false;
            });
            /** 寻找题目父节点 */
            const questionRoots = typeof this.opts.root === 'string' ? Array.from(document.querySelectorAll(this.opts.root)) : this.opts.root;
            this.totalQuestionCount += questionRoots.length;
            if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                console.debug('开始答题', this);
                console.debug('题目数量: ', questionRoots.length);
                console.debug('父节点列表: ', questionRoots);
            }
            /** 答题结果 */
            const results = [];
            if (questionRoots.length === 0) {
                throw new Error('未找到任何题目，答题结束。');
            }
            /** 搜索元素 */
            for (const questionRoot of questionRoots) {
                // 初始化上下文
                const ctx = {
                    searchInfos: [],
                    root: questionRoot,
                    elements: (0, dom_1.domSearchAll)(this.opts.elements, questionRoot),
                    type: undefined,
                    answerSeparators: this.opts.answerSeparators
                };
                /** 执行元素搜索钩子 */
                yield ((_b = (_a = this.opts).onElementSearched) === null || _b === void 0 ? void 0 : _b.call(_a, ctx.elements, questionRoot));
                /** 排除掉 null 的元素 */
                ctx.elements.title = (_c = ctx.elements.title) === null || _c === void 0 ? void 0 : _c.filter(Boolean);
                ctx.elements.options = (_d = ctx.elements.options) === null || _d === void 0 ? void 0 : _d.filter(Boolean);
                /** 获取题目类型 */
                if (typeof this.opts.work === 'object') {
                    ctx.type =
                        this.opts.work.type === undefined
                            ? // 使用默认解析器
                                (0, utils_1.defaultWorkTypeResolver)(ctx)
                            : // 自定义解析器
                                typeof this.opts.work.type === 'string'
                                    ? this.opts.work.type
                                    : this.opts.work.type(ctx);
                }
                results.push({
                    requested: false,
                    resolved: false,
                    ctx: ctx
                });
                // 题目检测钩子：早于搜题，供结果面板提前展示"等待搜索中"占位
                yield ((_f = (_e = this.opts).onQuestionDetected) === null || _f === void 0 ? void 0 : _f.call(_e, results[results.length - 1], results));
            }
            if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                console.debug('上下文已初始化: ', results);
            }
            /** 请求答案的线程 */
            const requestThread = (index) => __awaiter(this, void 0, void 0, function* () {
                var _g, _h, _j;
                let error;
                const result = results[index];
                const ctx = result.ctx || {};
                /** 强行关闭 */
                if (this.isClose === true) {
                    this.isRunning = false;
                    return;
                }
                /** 检查是否暂停中 */
                if (this.isStop) {
                    yield waitForContinuate(() => this.isStop);
                }
                /** 查找答案 */
                ctx.searchInfos = [];
                if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                    console.groupEnd();
                    console.group('开始搜题: ', (_g = ctx.elements.title) === null || _g === void 0 ? void 0 : _g.map((t) => t === null || t === void 0 ? void 0 : t.innerText).filter(Boolean).join(', ').slice(0, 20));
                    console.log('ctx', result.ctx);
                }
                try {
                    ctx.searchInfos = (yield this.opts.answerer(ctx.elements, ctx)) || [];
                    // 答案为 undefined 的情况， 需要赋值给一个空字符串，因为可能传回的题目中带有其他提示信息，或者题目里包含答案。
                    ctx.searchInfos.forEach((info) => {
                        info.results = info.results.map((ans) => {
                            ans.answer = ans.answer ? ans.answer.trim() : '';
                            return ans;
                        });
                    });
                }
                catch (err) {
                    error = String(err);
                }
                result.ctx = ctx;
                result.requested = true;
                result.error = error;
                if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                    console.log('搜题结果: ', ctx.searchInfos);
                }
                /** 回调 */
                yield ((_j = (_h = this.opts).onResultsUpdate) === null || _j === void 0 ? void 0 : _j.call(_h, results[index], index, results));
            });
            const waitForRequested = (result) => __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => {
                    const interval = setInterval(() => {
                        if ((result === null || result === void 0 ? void 0 : result.requested) === true) {
                            clearInterval(interval);
                            clearTimeout(timeout);
                            resolve();
                        }
                    }, 200);
                    const timeout = setTimeout(() => {
                        clearInterval(interval);
                        reject(new Error('答题超时！'));
                    }, (answer_wrapper_1.AnswerWrapperHandlerConfig.timeout_seconds + 10) * 1000);
                });
            });
            /** 答题线程， */
            const resolverThread = () => __awaiter(this, void 0, void 0, function* () {
                var _k, _l, _m, _o;
                for (let index = 0; index < results.length; index++) {
                    const result = results[index];
                    let error;
                    let res;
                    /** 强行关闭 */
                    if (this.isClose === true) {
                        this.isRunning = false;
                        return;
                    }
                    try {
                        /** 检查是否暂停中 */
                        if (this.isStop) {
                            yield waitForContinuate(() => this.isStop);
                        }
                        /** 等待搜题完毕 */
                        yield waitForRequested(result);
                    }
                    catch (err) {
                        // 超时错误
                    }
                    try {
                        if (result.ctx && result.ctx.searchInfos.length !== 0) {
                            /** 开始处理 */
                            if (typeof this.opts.work === 'object') {
                                if (result.ctx.elements.options) {
                                    /** 使用默认处理器 */
                                    if (result.ctx.type) {
                                        const resolver = (0, question_resolver_1.createDefaultQuestionResolver)(result.ctx, 
                                        // @ts-ignore work.optionText 跨 E 类型透传
                                        this.opts.work.optionText)[result.ctx.type];
                                        const handler = this.opts.work.handler;
                                        res = yield resolver(result.ctx.searchInfos, result.ctx.elements.options, handler);
                                    }
                                    else {
                                        error = '题目类型解析失败, 请自行提供解析器, 或者忽略此题。';
                                    }
                                }
                                else {
                                    error = 'elements.options 为空 ! 使用默认处理器, 必须提供题目选项的选择器。';
                                }
                            }
                            else {
                                /** 使用自定义处理器 */
                                const work = this.opts.work;
                                res = yield work(result.ctx);
                            }
                        }
                        else {
                            error = '搜索不到答案, 请重新运行, 或者忽略此题。';
                        }
                    }
                    catch (err) {
                        error = (err === null || err === void 0 ? void 0 : err.message) || err;
                    }
                    result.error = error;
                    /** 修改答题结果 */
                    result.result = res || { finish: false };
                    /** 设置答题完成 */
                    result.resolved = true;
                    if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                        console.log('答题完成: ', (_l = (_k = result.ctx) === null || _k === void 0 ? void 0 : _k.elements.title) === null || _l === void 0 ? void 0 : _l.map((t) => t === null || t === void 0 ? void 0 : t.innerText).join(', ').slice(0, 20), result);
                    }
                    /** 回调 */
                    yield ((_o = (_m = this.opts).onResultsUpdate) === null || _o === void 0 ? void 0 : _o.call(_m, result, index, results));
                }
            });
            /**
             * 搜题和答题分为两个线程
             */
            /** 多线程搜题 */
            const requestThreadHandler = () => __awaiter(this, void 0, void 0, function* () {
                /** 线程锁 */
                const locks = [];
                const waitForLock = () => {
                    return new Promise((resolve, reject) => {
                        const interval = setInterval(() => {
                            if (locks.length > 0) {
                                const lock = locks.shift();
                                if (lock) {
                                    resolve(lock);
                                    clearInterval(interval);
                                    clearTimeout(timeout);
                                }
                            }
                        }, 100);
                        const timeout = setTimeout(() => {
                            clearInterval(interval);
                            reject(new Error('获取线程锁超时！'));
                        }, 3 * 60 * 1000);
                    });
                };
                const requestThreads = [];
                for (let index = 0; index < results.length; index++) {
                    requestThreads.push(() => requestThread(index));
                }
                for (let index = 0; index < (this.opts.thread || 1); index++) {
                    locks.push(index + 1);
                }
                let requestFinished = 0;
                const promises = [];
                for (let index = 0; index < (this.opts.thread || 1); index++) {
                    promises.push(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            while (requestFinished < results.length && requestThreads.length > 0 && this.isClose === false) {
                                const thread = requestThreads.shift();
                                if (thread) {
                                    const lock = yield waitForLock();
                                    yield thread();
                                    requestFinished++;
                                    locks.push(lock);
                                }
                            }
                        }
                        catch (err) {
                            console.error(err);
                        }
                    }));
                }
                yield Promise.all(promises.map((f) => f()));
            });
            /** 答题线程 */
            yield Promise.all([resolverThread(), requestThreadHandler()]);
            this.isRunning = false;
            return results;
        });
    }
    /** 答题结果处理器 */
    uploadHandler(options) {
        var _a;
        const { results, type, callback } = options;
        if (type !== 'nomove') {
            let finished = 0;
            for (const result of results) {
                if ((_a = result.result) === null || _a === void 0 ? void 0 : _a.finish) {
                    finished++;
                }
            }
            const rate = results.length === 0 ? 0 : (finished / results.length) * 100;
            if (type === 'force') {
                return callback(rate, true);
            }
            else {
                return callback(rate, type === 'save' ? false : rate >= parseFloat(type.toString()));
            }
        }
    }
}
exports.OCSWorker = OCSWorker;
class CustomOCSWorker extends easy_us_1.CommonEventEmitter {
    constructor(opts) {
        super();
        this.isRunning = false;
        this.isClose = false;
        this.isStop = false;
        this.opts = opts;
    }
    /** 启动答题器  */
    doWork(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('start');
            this.isRunning = true;
            this.once('close', () => {
                this.isClose = true;
            });
            this.on('stop', () => {
                this.isStop = true;
            });
            this.on('continuate', () => {
                this.isStop = false;
            });
            const questions = yield ((_b = (_a = this.opts).questions) === null || _b === void 0 ? void 0 : _b.call(_a));
            if (options === null || options === void 0 ? void 0 : options.enable_debug) {
                console.debug('开始答题', this);
                console.debug('题目数量: ', this.opts.questions.length);
            }
            const results = [];
            for (let index = 0; index < questions.length; index++) {
                /** 强行关闭 */
                if (this.isClose === true) {
                    this.isRunning = false;
                    return;
                }
                /** 检查是否暂停中 */
                if (this.isStop) {
                    yield waitForContinuate(() => this.isStop);
                }
                const question = questions[index];
                results[index] = {
                    question: question.text,
                    requested: false,
                    resolved: false,
                    searchInfos: [],
                    type: question.type,
                    finish: false,
                    error: ''
                };
                try {
                    const infos = yield this.opts.answerer(question.text);
                    results[index].searchInfos = infos.map((i) => ({
                        name: i.name,
                        homepage: i.homepage,
                        results: i.results.map((r) => [r.question, r.answer, r.extra_data || {}]),
                        error: i.error
                    }));
                    results[index].requested = true;
                    (_d = (_c = this.opts).onResultsUpdate) === null || _d === void 0 ? void 0 : _d.call(_c, results[index], index, results);
                    try {
                        const resolved = yield this.opts.resolver(infos);
                        results[index].finish = resolved.finish;
                        results[index].error = resolved.error;
                        results[index].resolved = true;
                    }
                    catch (err) {
                        results[index].finish = false;
                        results[index].error = err instanceof Error ? err.message : String(err);
                        results[index].resolved = true;
                    }
                    (_f = (_e = this.opts).onResultsUpdate) === null || _f === void 0 ? void 0 : _f.call(_e, results[index], index, results);
                }
                catch (err) {
                    results[index].requested = true;
                    results[index].resolved = false;
                    results[index].finish = true;
                    results[index].error = err instanceof Error ? err.message : String(err);
                    (_h = (_g = this.opts).onResultsUpdate) === null || _h === void 0 ? void 0 : _h.call(_g, results[index], index, results);
                }
                yield easy_us_1.$.sleep(this.opts.period);
            }
        });
    }
}
exports.CustomOCSWorker = CustomOCSWorker;
function waitForContinuate(isStopping) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isStopping()) {
            yield new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (isStopping() === false) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 200);
            });
        }
    });
}
