import type { SearchInformation, SimplifyWorkResult } from '@ocsjs/core';
import { Project, Script } from 'easy-us';
export type LogType = 'log' | 'info' | 'debug' | 'warn' | 'error';
type RequestList = {
    id: string;
    url: string;
    method: string;
    type: string;
    data: any;
    headers: any;
    response?: string;
    error?: string;
    time: number;
}[];
/**
 * 题库缓存类型
 */
type QuestionCache = {
    title: string;
    answer: string;
    from: string;
    homepage: string;
    ai?: boolean;
};
/** 后台进程，处理与PC软件端的通讯，以及其他后台操作 */
export declare const BackgroundProject: Project<{
    elementRegister: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    console: Script<{}, {
        logs: {
            defaultValue: {
                type: LogType;
                content: string;
                time: number;
                stack: string;
            }[];
        };
    }, import("easy-us").ScriptMethods>;
    /** 渲染脚本，窗口渲染主要脚本（从 通用 迁移至 其他） */
    render: Script<{}, {
        notes: {
            defaultValue: string;
        };
        x: {
            defaultValue: number;
        };
        y: {
            defaultValue: number;
        };
        visual: {
            defaultValue: import("easy-us/lib/interfaces/custom-window").VisualType;
        };
        firstCloseAlert: {
            defaultValue: boolean;
        };
        fontsize: {
            label: string;
            attrs: {
                type: string;
                min: number;
                max: number;
                step: number;
            };
            defaultValue: number;
        };
        switchPoint: {
            label: string;
            attrs: {
                type: string;
                min: number;
                max: number;
                step: number;
                title: string;
            };
            defaultValue: number;
        };
    }, {
        pin: (script: any) => Promise<void> | undefined;
        minimize: () => void | undefined;
        setPosition: (x: number, y: number) => void;
        normal: () => void;
    }>;
    data: Script<{}, {
        notes: {
            defaultValue: string;
        };
        /**
         * 题库缓存
         */
        localQuestionCaches: {
            defaultValue: QuestionCache[];
            extra: {
                appConfigSync: boolean;
            };
        };
    }, {
        /**
         * 添加题库缓存
         */
        addQuestionCache: (...questionCacheItems: QuestionCache[]) => Promise<void>;
        addQuestionCacheFromWorkResult(swr: SimplifyWorkResult[]): void;
        /**
         * 将题库缓存作为题库并进行题目搜索
         * @param title 题目
         * @param whenSearchEmpty 当搜索结果为空，或者题库缓存功能被关闭时执行的函数
         */
        searchAnswerInCaches: (title: string, whenSearchEmpty: () => SearchInformation[] | Promise<SearchInformation[]>) => Promise<SearchInformation[]>;
        /**
         * 展示题库缓存管理弹窗
         */
        showQuestionCaches: () => void;
    }>;
    appConfigSync: Script<{}, {
        notes: {
            defaultValue: string;
        };
        sync_status: {
            defaultValue: "unconnect" | "not_playwright_environment" | "not_open_sync" | "synced";
        };
        closeSync: {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
            };
        };
    }, import("easy-us").ScriptMethods>;
    update: Script<{}, {
        notes: {
            defaultValue: string;
        };
        autoNotify: {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
                title: string;
            };
        };
        notToday: {
            defaultValue: number;
        };
        ignoreVersions: {
            defaultValue: string[];
        };
    }, {
        getLastVersion: () => Promise<{
            'last-version': string;
            resource: Record<string, string>;
            notes: string[];
        }>;
        /**
         * 查看更新日志
         */
        showChangelog: () => Promise<void>;
    }>;
    dev: Script<{}, {
        notes: {
            defaultValue: string;
        };
        show_debug_cursor: {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
            };
        };
        enable_answerer_debug: {
            defaultValue: boolean;
            label: string;
            attrs: {
                type: string;
            };
        };
    }, import("easy-us").ScriptMethods>;
    appLoginHelper: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    errorHandle: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    requestList: Script<{}, {
        notes: {
            defaultValue: string;
        };
        enable: {
            label: string;
            attrs: {
                type: string;
            };
            defaultValue: boolean;
        };
        methodFilter: {
            label: string;
            tag: "select";
            attrs: {
                placeholder: string;
            };
            options: string[][];
            defaultValue: string;
        };
        typeFilter: {
            label: string;
            tag: "select";
            attrs: {
                placeholder: string;
            };
            options: string[][];
            defaultValue: string;
        };
        searchValue: {
            label: string;
            attrs: {
                placeholder: string;
            };
            defaultValue: string;
        };
        list: {
            defaultValue: RequestList;
        };
    }, {
        render: (list: RequestList) => void;
    }>;
    environmentDetect: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    menus: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
}>;
type Console = Record<LogType, (...msg: any[]) => void>;
/** 日志对象，存储日志并显示在日志面板 */
export declare const $console: Console;
export {};
