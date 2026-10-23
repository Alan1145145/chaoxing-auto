import type { FontDecryptConfig } from './types';
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
export declare class FontDecryptor {
    /** 累计映射表（密文字 -> 真实字），同一字体终身复用 */
    private map;
    /** 任务队列：所有解密串行执行，避免并发破解/重复破解 */
    private queue;
    private readonly fontSource;
    private readonly config;
    private constructor();
    /**
     * 创建解密器并预热特征表（后台提前下载，避免首次解密卡顿）。
     */
    static create(fontSource: string | ArrayBuffer, config: FontDecryptConfig): Promise<FontDecryptor>;
    /** 当前映射表已破解的字符数 */
    get size(): number;
    /**
     * 解密一组元素：自动增量破解新字符后应用映射。
     * 多次调用通过内部队列串行化，重复字符不会重复破解。
     */
    decrypt(els: Element[]): Promise<void>;
    /**
     * 等待所有已排队的解密任务完成（无任务时立即 resolve）。
     * 供自动答题等下游程序在读取页面文本前调用，防止与解密冲突。
     */
    waitForIdle(): Promise<void>;
    private enqueue;
}
/** watchElements 返回的控制器 */
export interface WatchController {
    /** 停止监听 */
    stop: () => void;
    /**
     * 当前是否有待处理的工作（防抖中的扫描或正在执行的回调）。
     * 配合 FontDecryptor.waitForIdle 可实现"等待页面完全解密完成"。
     */
    isBusy: () => boolean;
}
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
export declare function watchElements(root: Element | Document, selector: string, onFound: (els: HTMLElement[]) => void | Promise<void>, options?: {
    debounceMs?: number;
}): WatchController;
