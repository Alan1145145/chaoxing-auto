import { Project, Script } from 'easy-us';
import { RemotePage } from '@ocsjs/core';
/** 工程导出 */
export declare const ZHSProject: Project<{
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    /**
     * 智慧树学习设置中心。
     *
     * 作为所有学习脚本的唯一可见入口，集中展示统一的使用提示与学习配置。
     * 实际的学习逻辑仍由下方被 hideInPanel 的各个学习脚本处理。
     */
    'study-center': Script<{}, Record<string, import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>>, import("easy-us").ScriptMethods>;
    /**
     * 智慧树作业考试中心。
     *
     * 作为所有作业/考试/掌握度脚本的唯一可见入口，集中展示统一的使用提示与作业考试配置。
     * 实际的答题逻辑仍由下方被 hideInPanel 的各个作业考试脚本处理。
     */
    'work-center': Script<{}, Record<string, import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>>, import("easy-us").ScriptMethods>;
    'gxk-study': Script<{}, {
        /** 学习记录 []  */
        studyRecord: {
            defaultValue: {
                /** 学习日期 */
                date: number;
                courses: {
                    /** 课程名 */
                    name: string;
                    /** 学习时间 */
                    time: number;
                }[];
            }[];
            extra: {
                appConfigSync: boolean;
            };
        };
        stopTime: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        restudy: import("easy-us").Config<any, boolean>;
        reloadWhenError: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        definition: import("easy-us").Config<any, "line1bq" | "line1gq">;
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
    }, {
        /**
         * 增加学习时间
         * @param courseName 课程名
         * @param val 增加的时间
         */
        increaseStudyTime: (courseName: string, val: number) => void;
    }>;
    'gxk-work': Script<{}, {
        workDelay: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
            };
        };
        readNotes: {
            defaultValue: boolean;
        };
    }, {
        getWorkInfo: (remotePage: RemotePage) => Promise<any>;
        work: () => Promise<void>;
    }>;
    'smart-study': Script<{}, {
        switchMode: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        restudy: import("easy-us").Config<any, boolean>;
        volume: import("easy-us").Config<any, number>;
        definition: import("easy-us").Config<any, "line1bq" | "line1gq">;
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
    }, import("easy-us").ScriptMethods>;
    'smart-work': Script<{}, {
        workDelay: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
            };
        };
    }, {
        start: () => Promise<void>;
    }>;
    'smart-exam': Script<{}, any, {
        start: () => Promise<void>;
    }>;
    'xnk-study': Script<{}, {
        restudy: import("easy-us").Config<any, boolean>;
        volume: import("easy-us").Config<any, number>;
    }, import("easy-us").ScriptMethods>;
    'xnk-work': Script<{}, {}, import("easy-us").ScriptMethods>;
    'wisdom-study': Script<{}, {
        restudy: import("easy-us").Config<any, boolean>;
        skipStudyTimeWarnDialog: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        reloadWhenError: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        definition: import("easy-us").Config<any, "line1bq" | "line1gq">;
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
    }, import("easy-us").ScriptMethods>;
    hike: Script<{}, {
        restudy: import("easy-us").Config<any, boolean>;
        reloadWhenError: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        definition: import("easy-us").Config<any, "line1bq" | "line1gq">;
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
    }, import("easy-us").ScriptMethods>;
    hike_v2: Script<{}, {
        restudy: import("easy-us").Config<any, boolean>;
        reloadWhenError: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
    }, import("easy-us").ScriptMethods>;
    'hike-work': Script<{}, {
        workDelay: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
            };
        };
    }, import("easy-us").ScriptMethods>;
    'hike-homework': Script<{}, {
        workDelay: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
            };
        };
    }, import("easy-us").ScriptMethods>;
}>;
