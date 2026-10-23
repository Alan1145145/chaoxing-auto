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
exports.createCommonAnswerer = exports.closeAnswerWrapperEmptyWarning = exports.answerWrapperEmptyWarning = exports.removeRedundantWords = exports.updateDynamicResult = exports.simplifyWorkResult = exports.extractTextWithImages = exports.createWorkerControl = exports.dynamicWorkTips = exports.commonWork = exports.isAnswererWrappersSupportImageOptimize = exports.imageToBase64 = exports.createImageSuggestion = exports.buildAnswererEnv = void 0;
const core_1 = require("@ocsjs/core");
const easy_us_1 = require("easy-us");
const common_1 = require("../projects/common");
const background_1 = require("../projects/background");
const _1 = require(".");
const answerer_env_1 = require("./answerer-env");
Object.defineProperty(exports, "buildAnswererEnv", { enumerable: true, get: function () { return answerer_env_1.buildAnswererEnv; } });
Object.defineProperty(exports, "createImageSuggestion", { enumerable: true, get: function () { return answerer_env_1.createImageSuggestion; } });
Object.defineProperty(exports, "imageToBase64", { enumerable: true, get: function () { return answerer_env_1.imageToBase64; } });
Object.defineProperty(exports, "isAnswererWrappersSupportImageOptimize", { enumerable: true, get: function () { return answerer_env_1.isAnswererWrappersSupportImageOptimize; } });
/**
 * 各脚本的 render 处理器绑定。
 * 每个脚本仅注册一次处理器；重复调用 commonWork 时仅替换执行内容引用，
 * 避免处理器无限叠加、旧闭包持有失效状态互相覆盖面板。
 */
const commonWorkRenderBindings = new WeakMap();
/** 为脚本注册一次性的 render 处理器；已注册过时更新其执行内容 */
function bindCommonWorkRender(script, render) {
    const binding = commonWorkRenderBindings.get(script);
    if (binding) {
        binding.current = render;
        return;
    }
    const created = { current: render };
    commonWorkRenderBindings.set(script, created);
    script.on('render', () => created.current());
}
/**
 * 通用作业考试工具方法
 */
function commonWork(script, options) {
    // 置顶当前脚本
    background_1.BackgroundProject.scripts.render.methods.pin(script);
    // 同步 worker 工作状态到搜索结果面板：
    // 动态答题器的"清空搜索结果"按钮在工作时隐藏，停止（结束/关闭/暂停）时显示
    const { setWorkerWorking } = common_1.CommonProject.scripts.workResults.methods;
    common_1.CommonProject.scripts.settings.on('answerer-wrapper-change', (curr, prev) => __awaiter(this, void 0, void 0, function* () {
        background_1.$console.log('answerer-wrapper-change curr.length', curr.length);
        if (curr.length > 0) {
            state.checkFailed = false;
            state.startBtnPressed = false;
            if (checkMessage instanceof easy_us_1.MessageElement) {
                checkMessage.remove();
            }
            yield (0, exports.closeAnswerWrapperEmptyWarning)();
            start();
        }
    }));
    /** 本次调用的可变状态（实例隔离，不与其它 commonWork 调用共享） */
    const state = {
        worker: undefined,
        startBtnPressed: false,
        checkFailed: false,
        running: false,
        controlPanel: null,
        paused: false,
        resultPanel: null
    };
    /** 显示答题控制按钮 */
    const createWorkControlPanel = () => {
        const { controlBtn, restartBtn, startBtn } = createWorkerControl({
            workerProvider: () => state.worker,
            paused: {
                get value() {
                    return state.paused;
                },
                set value(v) {
                    state.paused = v;
                }
            },
            onStart: () => __awaiter(this, void 0, void 0, function* () {
                state.startBtnPressed = true;
                if (checkMessage instanceof easy_us_1.MessageElement) {
                    checkMessage.remove();
                }
                yield (0, exports.closeAnswerWrapperEmptyWarning)();
                start();
            }),
            onRestart: () => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                (_a = state.worker) === null || _a === void 0 ? void 0 : _a.emit('close');
                // 允许 start() 重入（start 内有 running 防重入守卫）
                state.running = false;
                yield ((_b = options.onRestart) === null || _b === void 0 ? void 0 : _b.call(options));
                start();
            })
        });
        startBtn.style.flex = '1';
        startBtn.style.padding = '4px';
        restartBtn.style.flex = '1';
        restartBtn.style.padding = '4px';
        controlBtn.style.flex = '1';
        controlBtn.style.padding = '4px';
        const container = (0, easy_us_1.h)('div', { className: 'work-control-panel' }, state.running ? [controlBtn, restartBtn] : [startBtn]);
        state.controlPanel = container;
        return { container, startBtn, restartBtn, controlBtn };
    };
    /** 渲染面板内容（render 事件与 start() 共用，保证两处内容一致） */
    const renderPanelBody = () => {
        var _a, _b, _c;
        const gotoSettingsBtn = easy_us_1.$ui.button('👉 前往接入模型', {
            className: 'base-style-button',
            style: { flex: '1', padding: '4px' }
        });
        gotoSettingsBtn.onclick = () => {
            background_1.BackgroundProject.scripts.render.methods.pin(common_1.CommonProject.scripts.settings);
        };
        // 搜索结果区域复用：仅当被框架重建（detached）后才新建，
        // 避免 createWorkResultsPanel 每次调用都累积一组 config/store 监听器
        if (!((_a = state.resultPanel) === null || _a === void 0 ? void 0 : _a.isConnected)) {
            state.resultPanel = common_1.CommonProject.scripts.workResults.methods.createWorkResultsPanel();
        }
        (_c = (_b = script.panel) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.replaceChildren((0, easy_us_1.h)('div', { style: { marginTop: '12px' } }, state.checkFailed
            ? [(0, easy_us_1.h)('hr'), (0, easy_us_1.h)('div', { style: { display: 'flex' } }, [gotoSettingsBtn])]
            : [
                (0, easy_us_1.h)('hr'),
                // 控制面板始终渲染：未开始时为"开始答题"按钮；
                // start() 后复用 state.controlPanel（暂停 | 重新答题），re-render 不会丢失
                state.controlPanel || createWorkControlPanel().container,
                state.resultPanel
            ]));
    };
    // 控制区域与搜索结果区域只嵌入当前（学校）脚本面板；
    // CommonProject 的"搜索结果"脚本面板保持其自身 onrender 的纯结果区，不显示控制按钮，
    // 也避免同一个 DOM 元素被两个面板互相"偷走"导致状态不同步
    bindCommonWorkRender(script, renderPanelBody);
    let workOptions = common_1.CommonProject.scripts.settings.methods.getWorkOptions();
    /**
     * 检查题库是否配置，并询问是否开始答题
     */
    let checkMessage = (0, _1.workPreCheckMessage)(Object.assign(Object.assign({ onrun: () => state.startBtnPressed === false && start(), onclose: (_, closedMsg) => (checkMessage = closedMsg), onNoAnswererWrappers: () => {
            state.checkFailed = true;
        } }, workOptions), { start_delay_seconds: options.start_delay_seconds }));
    const start = () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        // 防重入：运行中重复触发（如连点重新开始）直接忽略
        if (state.running) {
            return;
        }
        if (state.checkFailed) {
            return (0, exports.answerWrapperEmptyWarning)(0);
        }
        // 重新获取题库配置（防止题库变化事件触发后无法获取到最新题库配置）
        workOptions = common_1.CommonProject.scripts.settings.methods.getWorkOptions();
        yield ((_a = options.beforeRunning) === null || _a === void 0 ? void 0 : _a.call(options));
        state.running = true;
        // 运行答题
        state.worker = options.workerProvider(workOptions);
        if (state.worker) {
            (_b = options.onWorkerCreated) === null || _b === void 0 ? void 0 : _b.call(options, state.worker);
        }
        const { controlBtn } = createWorkControlPanel();
        // 更新面板为运行态（与 render 事件共用同一渲染逻辑）
        renderPanelBody();
        if (state.worker) {
            setWorkerWorking(true);
            state.worker.on('stop', () => setWorkerWorking(false));
            state.worker.on('continuate', () => setWorkerWorking(true));
            state.worker.once('close', () => setWorkerWorking(false));
        }
        (_c = state.worker) === null || _c === void 0 ? void 0 : _c.once('done', () => {
            state.running = false;
            state.controlPanel = null;
            state.paused = false;
            controlBtn.disabled = true;
            common_1.CommonProject.scripts.workResults.methods.setWorkerWorking(false);
        });
    });
}
exports.commonWork = commonWork;
/**
 * 动态答题器提示（一题一题动态作答的作业/考试）：
 * 常驻提示用户在答题过程中不要手动切换题目，防止答题与搜索结果错乱；
 * worker 完成（done）或被关闭（close）时自动移除。
 */
function dynamicWorkTips(worker) {
    const msg = easy_us_1.$message.warn({
        content: '⚠️ 正在逐题自动答题，过程中请勿手动切换题目，防止答题与搜索结果错乱。',
        duration: 0
    });
    worker.once('done', () => msg === null || msg === void 0 ? void 0 : msg.remove());
    worker.once('close', () => msg === null || msg === void 0 ? void 0 : msg.remove());
}
exports.dynamicWorkTips = dynamicWorkTips;
/**
 * 答题控制
 */
function createWorkerControl(options) {
    var _a;
    let stopMessage;
    const paused = (_a = options.paused) !== null && _a !== void 0 ? _a : { value: false };
    const startBtn = easy_us_1.$ui.button('▶️开始答题');
    const restartBtn = easy_us_1.$ui.button('🔃重新答题');
    const controlBtn = easy_us_1.$ui.button(paused.value ? '▶️继续' : '⏸暂停');
    startBtn.onclick = () => {
        startBtn.remove();
        options.onStart();
    };
    restartBtn.onclick = () => {
        // 重新答题时，清除暂停提示并重置暂停状态（新 worker 从非暂停开始）
        stopMessage === null || stopMessage === void 0 ? void 0 : stopMessage.remove();
        paused.value = false;
        options.onRestart();
    };
    controlBtn.onclick = () => {
        var _a;
        paused.value = !paused.value;
        const worker = options.workerProvider();
        (_a = worker === null || worker === void 0 ? void 0 : worker.emit) === null || _a === void 0 ? void 0 : _a.call(worker, paused.value ? 'stop' : 'continuate');
        controlBtn.value = paused.value ? '▶️继续' : '⏸️暂停';
        if (paused.value) {
            stopMessage = easy_us_1.$message.warn({ duration: 0, content: '暂停中...' });
        }
        else {
            stopMessage === null || stopMessage === void 0 ? void 0 : stopMessage.remove();
        }
    };
    return { startBtn, restartBtn, controlBtn };
}
exports.createWorkerControl = createWorkerControl;
function extractTextWithImages(root, opts) {
    const parts = [];
    const images = [];
    const walk = (node) => {
        var _a;
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent || '');
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE)
            return;
        const el = node;
        if (el.tagName === 'IMG') {
            const img = el;
            if ((opts === null || opts === void 0 ? void 0 : opts.imgFilter) && !opts.imgFilter(img))
                return;
            const url = img.src;
            if (url) {
                parts.push(` ${url} `);
                images.push(url);
            }
            return;
        }
        if (el.tagName === 'BR') {
            parts.push('\n');
            return;
        }
        // 跳过 display:none（仅对已挂载元素；detached 元素 getComputedStyle 返回空，不跳过）
        try {
            const view = (_a = el.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
            if (view && el.isConnected && view.getComputedStyle(el).display === 'none')
                return;
        }
        catch (_b) {
            // 忽略
        }
        for (const child of Array.from(el.childNodes))
            walk(child);
    };
    walk(root);
    return { text: parts.join(''), images };
}
exports.extractTextWithImages = extractTextWithImages;
/** 将 {@link WorkResult} 转换成 {@link SimplifyWorkResult} */
function simplifyWorkResult(results, 
/**
 * 标题处理方法
 * 在答题时使用相同的处理方法，可以使答题结果显示的题目与搜题的题目保持一致
 */
titleTransform) {
    var _a, _b, _c, _d, _e, _f;
    const res = [];
    let i = 0;
    console.log('simplifyWorkResult', results);
    for (const wr of results) {
        const ques = (titleTransform === null || titleTransform === void 0 ? void 0 : titleTransform(((_a = wr.ctx) === null || _a === void 0 ? void 0 : _a.elements.title) || [], i)) ||
            ((_c = (_b = wr.ctx) === null || _b === void 0 ? void 0 : _b.elements.title) === null || _c === void 0 ? void 0 : _c.map((e) => e === null || e === void 0 ? void 0 : e.innerText.trim()).filter(Boolean).join('<br>')) ||
            '';
        res.push({
            requested: wr.requested,
            resolved: wr.resolved,
            error: wr.error,
            type: (_d = wr.ctx) === null || _d === void 0 ? void 0 : _d.type,
            question: ques,
            finish: (_e = wr.result) === null || _e === void 0 ? void 0 : _e.finish,
            searchInfos: ((_f = wr.ctx) === null || _f === void 0 ? void 0 : _f.searchInfos.map((sr) => ({
                error: sr.error,
                name: sr.name,
                homepage: sr.homepage,
                results: sr.results.map((ans) => [ans.question, ans.answer, ans.extra_data || {}])
            }))) || []
        });
        i++;
    }
    return res;
}
exports.simplifyWorkResult = simplifyWorkResult;
/**
 * 动态答题器结果 upsert：检测到题目即在结果面板占位（等待搜索中），
 * 随后每次状态推进（等待答题中→已答题/失败）原地更新。
 * 供动态流程（一题一题加载）的 onQuestionDetected 与 onResultsUpdate 共同调用，
 * 解决全部流程结束后才显示结果、用户对过程无感知的问题。
 */
function updateDynamicResult(current, titleTransform) {
    const [item] = simplifyWorkResult([current], titleTransform);
    return common_1.CommonProject.scripts.workResults.methods.upsertResult(item);
}
exports.updateDynamicResult = updateDynamicResult;
/**
 * 从题目中移除指定的冗余词
 */
function removeRedundantWords(str, words) {
    for (const word of words.map((w) => w.trim())) {
        str = str.replace(word, '');
    }
    return str;
}
exports.removeRedundantWords = removeRedundantWords;
let answererWrapperUnsetMessage;
exports.answerWrapperEmptyWarning = easy_us_1.cors.defineTopFunction((duration) => {
    const setting = (0, easy_us_1.h)('button', { className: 'base-style-button-secondary' }, '通用-全局设置');
    setting.onclick = () => {
        background_1.BackgroundProject.scripts.render.methods.pin(common_1.CommonProject.scripts.settings);
        setTimeout(() => {
            var _a, _b;
            (_b = (_a = easy_us_1.$elements.root) === null || _a === void 0 ? void 0 : _a.querySelector('[value="点击配置"]')) === null || _b === void 0 ? void 0 : _b.click();
        }, 500);
    };
    answererWrapperUnsetMessage === null || answererWrapperUnsetMessage === void 0 ? void 0 : answererWrapperUnsetMessage.remove();
    answererWrapperUnsetMessage = easy_us_1.$message.warn({
        content: (0, easy_us_1.h)('span', {}, ['你还没设置题库，无法自动答题，请切换到 ', setting, ' 页面进行配置。']),
        duration: duration
    });
});
exports.closeAnswerWrapperEmptyWarning = easy_us_1.cors.defineTopFunction(() => {
    console.log(answererWrapperUnsetMessage);
    answererWrapperUnsetMessage === null || answererWrapperUnsetMessage === void 0 ? void 0 : answererWrapperUnsetMessage.remove();
    answererWrapperUnsetMessage = undefined;
});
/**
 * 创建通用的 answerer 回调，封装搜题缓存、延迟、env 构建、AI 图片建议等公共逻辑
 * @param options.titleTransform 标题转换函数，接收 (elements, ctx)，返回字符串标题
 * @param options.optionsTransform 选项转换函数（可选），接收 (elements, ctx)，返回选项文本字符串；
 *   默认取 ctx.elements.options 的 innerText 拼接
 * @param options.answererWrappers 题库配置
 * @param options.period 搜题间隔（秒），默认 3
 */
function createCommonAnswerer(options) {
    const normalize = (v) => {
        if (v == null)
            return { text: '' };
        return typeof v === 'string' ? { text: v } : v;
    };
    /** 题目文本中的图片 URL 快速检测（仅用于降级提示，非精确提取；无 /g 标志，test 调用安全） */
    const QUESTION_IMAGE_REGEX = /https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|bmp|webp|svg)/i;
    /** 降级提示仅每次会话提示一次，避免逐题刷屏 */
    let imageOptimizeOffWarned = false;
    let imageConvertFailWarned = false;
    return (elements, ctx) => __awaiter(this, void 0, void 0, function* () {
        const titleResult = normalize(options.titleTransform(elements, ctx));
        const title = titleResult.text;
        if (!title) {
            throw new Error('题目为空，请查看题目是否为空，或者忽略此题');
        }
        const titleImages = titleResult.images;
        return background_1.BackgroundProject.scripts.data.methods.searchAnswerInCaches(title, () => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            yield core_1.$.sleep(((_a = options.period) !== null && _a !== void 0 ? _a : 3) * 1000);
            const optResult = normalize(options.optionsTransform
                ? options.optionsTransform(elements, ctx)
                : ((_b = ctx.elements.options) !== null && _b !== void 0 ? _b : [])
                    .filter(Boolean)
                    .map((o) => o.innerText)
                    .join('\n'));
            const questionHasImages = ((_c = titleImages === null || titleImages === void 0 ? void 0 : titleImages.length) !== null && _c !== void 0 ? _c : 0) + ((_e = (_d = optResult.images) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > 0 ||
                QUESTION_IMAGE_REGEX.test(title) ||
                QUESTION_IMAGE_REGEX.test(optResult.text);
            // 题目含图片但未开启图片题优化：此前为静默降级（原始 URL 发出后大概率搜不到），显式提示用户开启
            if (questionHasImages && !common_1.CommonProject.scripts.settings.cfg.imageOptimize && !imageOptimizeOffWarned) {
                imageOptimizeOffWarned = true;
                easy_us_1.$message.warn({
                    content: '检测到题目包含图片，但未开启「图片题优化」（通用-全局设置-高级设置中开启），图片题将无法搜题。',
                    duration: 10
                });
            }
            const { env, imageUrls } = yield (0, answerer_env_1.buildAnswererEnv)({
                type: ctx.type,
                title,
                options: optResult.text,
                titleImages,
                optionsImages: optResult.images,
                enableImageOptimize: common_1.CommonProject.scripts.settings.cfg.imageOptimize &&
                    (0, answerer_env_1.isAnswererWrappersSupportImageOptimize)(options.answererWrappers),
                includeOcsAuthToken: options.answererWrappers.some((wrapper) => wrapper.name === 'OCS 内置题库')
            });
            // 已开启优化但全部图片转换失败（CORS/防盗链极端情况）：此前静默回退普通题，显式提示
            if (questionHasImages &&
                common_1.CommonProject.scripts.settings.cfg.imageOptimize &&
                imageUrls.length === 0 &&
                !imageConvertFailWarned) {
                imageConvertFailWarned = true;
                easy_us_1.$message.warn({
                    content: '题目图片下载或转换失败（可能跨域受限），本题将按普通题目搜索，图片题可能无法匹配。',
                    duration: 10
                });
            }
            const searchInfos = yield (0, core_1.defaultAnswerWrapperHandler)(options.answererWrappers, env);
            // 将 AI 答案中的 [图片N] 占位符还原为对应图片 URL，使选项匹配可以命中图片选项。
            // imageUrls 与实际上传的 env.images 严格同序（createImageSuggestion 单一数据源，含转换失败过滤）。
            // 覆盖服务端未还原的场景：标题图占位符 / 选项行数不对齐 / 第三方题库。
            if (imageUrls.length) {
                for (const info of searchInfos) {
                    for (const res of info.results) {
                        if (res.answer && res.answer.includes('[图片')) {
                            res.answer = res.answer.replace(/\[图片(\d+)\]/g, (m, n) => { var _a; return (_a = imageUrls[Number(n) - 1]) !== null && _a !== void 0 ? _a : m; });
                        }
                    }
                }
            }
            return searchInfos;
        }));
    });
}
exports.createCommonAnswerer = createCommonAnswerer;
