/**
 * 等待视频加载并获取视频
 */
export declare function waitForMedia(options?: {
    /**
     * 视频选择器
     */
    videoSelector?: string;
    /**
     * 音频选择器
     */
    audioSelector?: string;
    /**
     * 根元素
     */
    root?: HTMLElement | Document;
    timeout?: number;
    filter?: (video: HTMLVideoElement | HTMLAudioElement) => boolean;
}): Promise<HTMLVideoElement | HTMLAudioElement>;
export declare function waitForElement(selector: string | {
    (): HTMLElement | undefined | null;
}, opts?: {
    timeout_seconds?: number;
    check_period_ms?: number;
}): Promise<HTMLElement | null | undefined>;
export declare function waitFor<T>(predicate: () => T, opts?: {
    timeout_seconds?: number;
    check_period_ms?: number;
}): Promise<T>;
