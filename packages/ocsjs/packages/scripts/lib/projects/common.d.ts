import { SimplifyWorkResult, WorkUploadType } from '@ocsjs/core';
import { Project, Script, MessageElement } from 'easy-us';
import type { AnswererWrapper } from '@ocsjs/core';
export declare function createOcsQuestionBankAnswererWrapper(baseUrl?: string): AnswererWrapper;
declare const state: {
    workResult: {
        /** 答题 worker 是否正在工作中（动态答题器的"清空搜索结果"按钮在工作时隐藏，结束时显示） */
        isWorkerWorking: boolean;
        /**
         * 题目位置同步处理器
         */
        questionPositionSyncHandler: {
            cx: (index: number) => void;
            'zhs-gxk': (index: number) => void;
            'zhs-xnk': (index: number) => void;
            'zhs-smart': (index: number) => void;
            'zhs-fusion': (index: number) => void;
            'zhs-hike': (index: number) => void;
            icve: (index: number) => void;
            zjy: (index: number) => void;
            icourse: (index: number) => void;
        };
    };
    setting: {
        /** 图片题优化兼容性提示消息（可移除） */
        imageOptimizeMessage: MessageElement | undefined;
    };
};
export declare const CommonProject: Project<{
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    settings: Script<{
        'answerer-wrapper-change': (curr: AnswererWrapper[], pre: AnswererWrapper[]) => void;
    }, {
        notes: {
            defaultValue: string;
        };
        answererWrappers: {
            separator: string;
            defaultValue: AnswererWrapper[];
        };
        /**
         * 禁用的题库
         */
        disabledAnswererWrapperNames: {
            defaultValue: string[];
        };
        answererWrappersButton: {
            label: string;
            defaultValue: string;
            attrs: {
                type: string;
            };
            /** 「⋯」更多按钮：进入 OCS API 题库或手动配置弹窗 */
            suffixSlot(this: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>): HTMLElement;
            onload(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void;
        };
        upload: {
            label: string;
            tag: "select";
            defaultValue: WorkUploadType;
            options: (string[] | [any, string, string])[];
            attrs: {
                title: string;
            };
        };
        'work-when-no-job': {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
        };
        'randomWork-choice': {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
        };
        'randomWork-complete': {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
        };
        'randomWork-completeTexts-textarea': {
            defaultValue: string;
            label: string;
            tag: "textarea";
            showIf: string;
            attrs: {
                title: string;
                style: {
                    minWidth: string;
                    minHeight: string;
                };
            };
            onload(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, el: import("easy-us").ConfigElement<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap>): void;
        };
        advancedSettings: {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            options?: string[][] | {
                label: string;
                value: string;
                title?: string | undefined;
            }[] | undefined;
            tag?: any;
            showIf?: string | [string, (curr: any, pre: any, store: import("easy-us").StoreProvider) => boolean] | undefined;
            elementClassName?: string | undefined;
            labelClassName?: string | undefined;
            providerClassName?: string | undefined;
            enableForAttribute?: boolean | undefined;
            onload?: ((this: any, el: import("easy-us").ConfigElement<any>) => void) | undefined;
            sync?: boolean | undefined;
            prefixSlot?: import("easy-us").ConfigSlotProvider | undefined;
            suffixSlot?: import("easy-us").ConfigSlotProvider | undefined;
            separator?: string | undefined;
            extra?: any;
        };
        thread: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
                title: string;
            };
            defaultValue: number;
        };
        imageOptimize: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        answerWrapperHandlerTimeout: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
                title: string;
            };
            defaultValue: number;
        };
        stopSecondWhenFinish: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
                title: string;
            };
            defaultValue: number;
        };
        period: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
                title: string;
            };
            defaultValue: number;
        };
        answerSeparators: {
            showIf: string;
            elementClassName: string;
            label: string;
            attrs: {
                title: string;
            };
            defaultValue: string;
            onload(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, el: import("easy-us").ConfigElement<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap>): void;
        };
        redundanceWordsText: {
            showIf: string;
            elementClassName: string;
            defaultValue: string;
            label: string;
            tag: "textarea";
            attrs: {
                title: string;
                style: {
                    minWidth: string;
                    minHeight: string;
                };
            };
            onload(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, el: import("easy-us").ConfigElement<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap>): void;
        };
        notification: {
            separator: string;
            label: string;
            attrs: {
                title: string;
            };
            tag: "select";
            defaultValue: "all" | "only-notify" | "notify-and-voice" | "no-notify";
            suffixSlot: (this: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>) => HTMLButtonElement;
            options: string[][];
        };
        enableQuestionCaches: {
            label: string;
            defaultValue: boolean;
            attrs: {
                type: string;
            };
            suffixSlot: (this: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>) => HTMLButtonElement;
        };
    }, {
        /**
         * 获取自动答题配置，包括题库配置
         */
        getWorkOptions: () => {
            notes: string;
            answererWrappers: AnswererWrapper[];
            disabledAnswererWrapperNames: string[];
            answererWrappersButton: string;
            upload: WorkUploadType;
            'work-when-no-job': boolean;
            'randomWork-choice': boolean;
            'randomWork-complete': boolean;
            'randomWork-completeTexts-textarea': string;
            advancedSettings: boolean;
            thread: number;
            imageOptimize: boolean;
            answerWrapperHandlerTimeout: number;
            stopSecondWhenFinish: number;
            period: number;
            answerSeparators: string;
            redundanceWordsText: string;
            notification: "all" | "only-notify" | "notify-and-voice" | "no-notify";
            enableQuestionCaches: boolean;
        } & {
            notes?: string | undefined;
        };
        /**
         * 根据全局设置的配置，发起通知
         * @param content
         * @param opts
         */
        notificationBySetting: (content: string, opts?: {
            extraTitle?: string;
            /** 显示时间，单位为秒，默认为 30 秒， 0 则表示一直存在 */
            duration?: number;
            /** 通知点击时 */
            onclick?: () => void;
            /** 通知关闭时 */
            ondone?: () => void;
        }) => void;
    }>;
    workResults: Script<{}, {
        notes: {
            defaultValue: string;
        };
        totalQuestionCount: {
            defaultValue: number;
        };
        requestedCount: {
            defaultValue: number;
        };
        resolvedCount: {
            defaultValue: number;
        };
        currentResultIndex: {
            defaultValue: number;
        };
        /**
         * 是否为动态答题器（题目动态加载，结果逐题累积，例如超星非整卷预览、智慧树/智慧职教逐题作答），
         * 动态答题器不会自动清空搜索结果，因此需要显示手动清空按钮
         */
        dynamicResults: {
            defaultValue: boolean;
        };
        questionPositionSyncHandlerType: {
            defaultValue: "cx" | "zhs-gxk" | "zhs-xnk" | "zhs-smart" | "zhs-fusion" | "zhs-hike" | "icve" | "zjy" | "icourse" | undefined;
        };
    }, {
        /**
         * 从搜索结果中计算状态，并更新
         */
        updateWorkStateByResults: (results: {
            requested: boolean;
            resolved: boolean;
        }[]) => void;
        /**
         * 更新状态
         */
        updateWorkState: (state: {
            totalQuestionCount: number;
            requestedCount: number;
            resolvedCount: number;
        }) => void;
        /**
         * 刷新状态
         */
        refreshState: () => void;
        /**
         * 设置答题 worker 工作状态（由 commonWork 在 worker 生命周期事件中调用）。
         * 动态答题器的"清空搜索结果"按钮仅在 worker 停止（结束/错误/暂停）时显示，
         * 正在搜题时隐藏，避免误清空正在累积的结果。
         */
        setWorkerWorking: (working: boolean) => void;
        /**
         * 清空搜索结果
         */
        clearResults: () => Promise<any>;
        getResults(): Promise<SimplifyWorkResult[]> | undefined;
        setResults(results: SimplifyWorkResult[]): Promise<any>;
        appendResults(results: SimplifyWorkResult[]): Promise<any>;
        /**
         * 追加或更新搜索结果（按题目文本匹配，存在则原地更新，不存在则追加）。
         * 动态答题器在"检测到题目→搜题→答题"各阶段对同一题目重复调用，
         * 实现序号与内容的渐进式状态推进（等待搜索中→等待答题中→已答题/失败）。
         * 与 appendResults 一样，调用即视为动态答题模式。
         */
        upsertResult(result: SimplifyWorkResult): Promise<any>;
        /**
         * 刷新搜索结果状态，清空搜索结果，置顶搜索结果面板
         * @param opts.dynamic 是否为动态答题器（题目动态加载，结果逐题累积），动态答题器会显示手动清空按钮
         */
        init(opts?: {
            questionPositionSyncHandlerType?: keyof typeof state.workResult.questionPositionSyncHandler;
            dynamic?: boolean;
        }): void;
        /**
         * 创建搜索结果面板
         * @param mount 挂载点
         */
        createWorkResultsPanel: (mount?: HTMLElement) => HTMLElement;
    }>;
    onlineSearch: Script<{}, {
        notes: {
            defaultValue: string;
        };
        selectSearch: {
            label: string;
            defaultValue: boolean;
            attrs: {
                type: string;
                title: string;
            };
        };
        searchValue: {
            sync: true;
            label: string;
            tag: "textarea";
            attrs: {
                placeholder: string;
                style: {
                    minWidth: string;
                    minHeight: string;
                };
            };
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    edgeMinimize: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    hack: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    disableDialog: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
}>;
export {};
