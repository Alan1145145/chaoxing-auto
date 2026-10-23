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
exports.watchElements = exports.FontDecryptor = void 0;
const bitmap_1 = require("./bitmap");
const ref_table_1 = require("./ref-table");
/**
 * 动态解密器
 *
 * 解决"内容动态渲染"场景（如点击题号才显示题目、翻页加载）：
 * 同一字体的映射表只需破解一次并常驻内存，之后每次内容变化
 * 只对"新出现的字符"做增量破解（相邻题目用字高度重叠，
 * 增量通常为 0~10 字，毫秒级完成），再应用全量映射解密。
 *
 * 典型用法：
 * ```ts
 * const decryptor = await FontDecryptor.create(fontUrl, { refTableUrl, fontWeight: '250' });
 * // 内容变化时调用（可配合 watchElements 自动监听）
 * await decryptor.decrypt(newElements);
 * // 自动答题等下游程序在读取文本前等待解密完成，防止冲突
 * await decryptor.waitForIdle();
 * ```
 */
class FontDecryptor {
    constructor(fontSource, config) {
        /** 累计映射表（密文字 -> 真实字），同一字体终身复用 */
        this.map = {};
        /** 任务队列：所有解密串行执行，避免并发破解/重复破解 */
        this.queue = Promise.resolve();
        this.fontSource = fontSource;
        this.config = config;
    }
    /**
     * 创建解密器并预热特征表（后台提前下载，避免首次解密卡顿）。
     */
    static create(fontSource, config) {
        return __awaiter(this, void 0, void 0, function* () {
            // loadRefTable 有全局缓存，预热后后续 crackFont 不再产生网络等待
            yield (0, ref_table_1.loadRefTable)(config.refTableUrl);
            return new FontDecryptor(fontSource, config);
        });
    }
    /** 当前映射表已破解的字符数 */
    get size() {
        return Object.keys(this.map).length;
    }
    /**
     * 解密一组元素：自动增量破解新字符后应用映射。
     * 多次调用通过内部队列串行化，重复字符不会重复破解。
     */
    decrypt(els) {
        return this.enqueue(() => __awaiter(this, void 0, void 0, function* () {
            const chars = (0, bitmap_1.collectChars)(els);
            const newChars = [...new Set(chars)].filter((c) => c.trim() !== '' && !(c in this.map));
            if (newChars.length) {
                // 小批量增量破解走主线程更快（Worker 每次需克隆特征表并加载字体，
                // 固定开销大于收益）；大批量（首次/全量）仍走 Worker 避免阻塞 UI
                const useWorker = newChars.length > 20 ? this.config.useWorker : false;
                const r = yield (0, bitmap_1.crackFont)(this.fontSource, newChars, Object.assign(Object.assign({}, this.config), { useWorker }));
                Object.assign(this.map, r.map);
            }
            (0, bitmap_1.decryptElements)(els, this.map);
        }));
    }
    /**
     * 等待所有已排队的解密任务完成（无任务时立即 resolve）。
     * 供自动答题等下游程序在读取页面文本前调用，防止与解密冲突。
     */
    waitForIdle() {
        return this.queue;
    }
    enqueue(task) {
        // 前一个任务失败也不阻塞后续任务
        const run = this.queue.then(task, task);
        this.queue = run.catch(() => undefined);
        return run;
    }
}
exports.FontDecryptor = FontDecryptor;
/**
 * 监听 root 下匹配 selector 的元素出现（含已存在的），交给回调处理。
 *
 * 特性：
 * - MutationObserver + 防抖合并：一次渲染的多次 DOM 变更只触发一次回调
 * - 防重入：回调执行期间的新变更会排队到下一轮，不会并发执行
 * - 防死循环：回调修改 DOM（如解密改写文本）会再次触发扫描，
 *   但只要回调使元素不再匹配 selector（如移除加密 class），扫描即收敛
 *
 * @returns 控制器（stop 停止监听，isBusy 查询是否有待处理工作）
 */
function watchElements(root, selector, onFound, options) {
    var _a, _b;
    const target = root instanceof Document ? (_a = root.body) !== null && _a !== void 0 ? _a : root.documentElement : root;
    const debounceMs = (_b = options === null || options === void 0 ? void 0 : options.debounceMs) !== null && _b !== void 0 ? _b : 50;
    let stopped = false;
    let timer;
    let running = false;
    let rescan = false;
    const scan = () => __awaiter(this, void 0, void 0, function* () {
        if (stopped || running) {
            rescan = !stopped;
            return;
        }
        running = true;
        try {
            const els = Array.from(target.querySelectorAll(selector));
            if (els.length) {
                yield onFound(els);
            }
        }
        catch (err) {
            console.error('[font-decrypt] watchElements 回调执行失败：', err);
        }
        finally {
            running = false;
            if (rescan && !stopped) {
                rescan = false;
                schedule();
            }
        }
    });
    const schedule = () => {
        if (stopped) {
            return;
        }
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = undefined;
            scan();
        }, debounceMs);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    // 立即处理已存在的内容
    scan();
    return {
        stop: () => {
            stopped = true;
            clearTimeout(timer);
            timer = undefined;
            observer.disconnect();
        },
        isBusy: () => timer !== undefined || running || rescan
    };
}
exports.watchElements = watchElements;
