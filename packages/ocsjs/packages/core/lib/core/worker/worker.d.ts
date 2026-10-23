import { CommonEventEmitter } from 'easy-us';
import { CustomWorkOptions, RawElements, WorkerEvents, WorkOptions, WorkResult, WorkUploadType } from './interface';
/**
 * 自动答题器， 传入一些指定的配置， 就可以进行自动答题。
 *
 * @param work      工作器, 传入一个方法可自定义工作器，或者使用默认的工作器，详情： {@link WorkOptions.work}
 * @param answerer  查题器, : 默认是 {@link defaultAnswerWrapperHandler}
 *
 */
export declare class OCSWorker<E extends RawElements = RawElements> extends CommonEventEmitter<WorkerEvents> {
    opts: WorkOptions<E>;
    isRunning: boolean;
    isClose: boolean;
    isStop: boolean;
    totalQuestionCount: number;
    /** 元素观察器定时器（root 消失检测） */
    private rootObserverTimer?;
    /** root 开始持续消失的时间戳（未消失为 undefined） */
    private rootLostSince?;
    constructor(opts: WorkOptions<E>);
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
    private startRootObserver;
    /** 停止元素观察器 */
    private stopRootObserver;
    /** 启动答题器  */
    doWork(options?: {
        enable_debug?: boolean;
    }): Promise<WorkResult<E>[]>;
    /** 答题结果处理器 */
    uploadHandler(options: {
        results: WorkResult<E>[];
        type: WorkUploadType;
        /**
         * 是否上传处理器
         *
         * @param  uploadable  是否可以上传
         * @param finishedRate 完成率
         */
        callback: (finishedRate: number, uploadable: boolean) => void | Promise<void>;
    }): void | Promise<void>;
}
export declare class CustomOCSWorker extends CommonEventEmitter<WorkerEvents> {
    opts: CustomWorkOptions;
    isRunning: boolean;
    isClose: boolean;
    isStop: boolean;
    constructor(opts: CustomWorkOptions);
    /** 启动答题器  */
    doWork(options?: {
        enable_debug?: boolean;
    }): Promise<void>;
}
