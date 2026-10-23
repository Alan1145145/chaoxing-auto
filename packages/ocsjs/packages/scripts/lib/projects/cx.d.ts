/** global Ext videojs getTeacherAjax jobs */
import { Project, Script } from 'easy-us';
type VideoQuizStrategy = 'random' | 'ignore';
export declare const CXProject: Project<{
    /**
     * 创建超星独立脚本防止污染其他脚本环境
     */
    env: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    study: Script<{}, {
        notes: {
            defaultValue: string;
        };
        playbackRate: {
            attrs: {
                title: string;
            };
            defaultValue: any;
            label?: string | undefined;
            prefixSlot?: import("easy-us").ConfigSlotProvider | undefined;
            suffixSlot?: import("easy-us").ConfigSlotProvider | undefined;
            sync?: boolean | undefined;
            separator?: string | undefined;
            onload?: ((this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, el: import("easy-us").ConfigElement<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap>) => void) | undefined;
            extra?: any;
            options?: string[][] | {
                label: string;
                value: string;
                title?: string | undefined;
            }[] | undefined;
            tag?: keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap | undefined;
            showIf?: string | [string, (curr: any, pre: any, store: import("easy-us").StoreProvider) => boolean] | undefined;
            elementClassName?: string | undefined;
            labelClassName?: string | undefined;
            providerClassName?: string | undefined;
            enableForAttribute?: boolean | undefined;
        };
        volume: import("easy-us").Config<any, number>;
        videoQuizStrategy: {
            label: string;
            tag: "select";
            options: string[][];
            attrs: {
                title: string;
            };
            defaultValue: VideoQuizStrategy;
        };
        mode: {
            label: string;
            tag: "select";
            options: string[][];
            defaultValue: "next" | "job" | "manually";
        };
        restudy: {
            label: string;
            attrs: {
                title: string;
                type: string;
            };
            defaultValue: boolean;
        };
        enables: {
            label: string;
            attrs: {
                type: string;
            };
            defaultValue: boolean;
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
        autoJumpToUnFinishJob: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        forceLearn: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                title: string;
                type: string;
            };
            defaultValue: boolean;
        };
        backToFirstWhenFinish: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        showTextareaWhenEdit: {
            elementClassName: string;
            label: string;
            showIf: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        notifyWhenHasFaceRecognition: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
            };
            defaultValue: boolean;
        };
        /**
         *
         * 开启的任务点
         *
         * media : 音视频
         * ppt : 文档和书籍翻阅
         * test : 章节测试
         * read : 阅读
         * live : 直播课
         *
         */
        enableMedia: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        enablePPT: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        enableChapterTest: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        enableHyperlink: {
            elementClassName: string;
            showIf: string;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
    }, import("easy-us").ScriptMethods>;
    work: Script<{}, {
        notes: import("easy-us").Config<any, string>;
    }, import("easy-us").ScriptMethods>;
    autoRead: Script<{}, {
        notes: {
            defaultValue: string;
        };
        restartAfterFinish: {
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
    }, import("easy-us").ScriptMethods>;
    /**
     * 有时候进入课程会默认在，任务页面，会出现任务为空，部分用户会以为没有章节任务，所以添加此脚本
     */
    pageRedirect: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    versionRedirect: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    examRedirect: Script<{}, {
        notes: import("easy-us").Config<any, string>;
    }, import("easy-us").ScriptMethods>;
    rateHack: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    copyHack: Script<{}, import("easy-us").ScriptConfigs, {
        /** 解除输入框无法复制粘贴 */
        hackEditorPaste(): void;
    }>;
    studyDispatcher: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    cxSecretFontRecognize: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    jfkGuide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
}>;
/**
 * cx 任务学习
 */
export declare function study(opts: typeof CXProject.scripts.study.cfg): Promise<void>;
/**
 * 永久固定显示视频进度
 */
export declare function fixedVideoProgress(): void;
export {};
