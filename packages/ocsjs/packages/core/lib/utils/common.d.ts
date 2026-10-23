/**
 * 公共的工具库
 */
export declare const $: {
    /** 创建唯一id ， 不带横杠 */
    uuid(): string;
    /**
     * 生成随机数， 使用 Math.round 取整
     * @param min 最小值
     * @param max 最大值
     */
    random(min: number, max: number): number;
    /**
     * 暂停
     * @param period 毫秒
     */
    sleep(period: number): Promise<void>;
    /**
     * 当前是否处于浏览器环境
     */
    isInBrowser(): boolean;
    /**
     * 使元素变成纯文本对象，（跨域时对象上下文会被销毁）
     * @param el 元素
     */
    elementToRawObject(el: HTMLElement | undefined | null): any;
    /**
     * 监听页面宽度变化
     * @param el 任意元素，如果此元素被移除，则不执行 resize 回调
     * @param handler resize 回调
     */
    onresize<E extends HTMLElement>(el: E, handler: (el: E) => void): void;
    /** 是否处于顶级 window ，而不是子 iframe */
    isInTopWindow(): boolean;
    /**
     * 创建弹出窗口
     * @param url 地址
     * @param winName 窗口名
     * @param w 宽
     * @param h 高
     * @param scroll 滚动条
     */
    createCenteredPopupWindow(url: string, winName: string, opts: {
        width: number;
        height: number;
        scrollbars: boolean;
        resizable: boolean;
    }): Window | null;
    transition: (el: HTMLElement, properties: keyof CSSStyleDeclaration, duration_ms: number, val: any, options?: {
        reset_ms?: number;
        timing_function?: string;
    }) => Promise<void>;
};
