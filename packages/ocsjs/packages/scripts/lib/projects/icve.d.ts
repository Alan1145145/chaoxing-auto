import { Project, Script } from 'easy-us';
export declare const IcveMoocProject: Project<{
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    /** 智慧职教学习中心 */
    studyCenter: Script<{}, {
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        /** 章节列表 */
        currentCourseUrlList: {
            defaultValue: string[];
        };
    }, import("easy-us").ScriptMethods>;
    /** MOOC 学院 */
    study: Script<{}, {
        notes: {
            defaultValue: string;
        };
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        restudy: import("easy-us").Config<any, boolean>;
        showScrollBar: {
            label: string;
            attrs: {
                type: string;
            };
            defaultValue: boolean;
        };
        expandAll: {
            label: string;
            attrs: {
                type: string;
            };
            defaultValue: boolean;
        };
        switchPeriod: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                max: number;
                step: number;
            };
        };
    }, import("easy-us").ScriptMethods>;
    work: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    workDispatcher: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    'ai-study': Script<{}, {
        notes: {
            defaultValue: string;
        };
        volume: import("easy-us").Config<any, number>;
        playbackRate: {
            label: string;
            tag: "select";
            options: string[][];
            defaultValue: string;
        };
        autoOpenAllChapter: {
            label: string;
            attrs: {
                title: string;
                type: string;
            };
            defaultValue: boolean;
        };
        restudy: import("easy-us").Config<any, boolean>;
    }, import("easy-us").ScriptMethods>;
    'ai-work': Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
}>;
