import { Project, Script } from 'easy-us';
type CourseType = {
    levelName: string;
    fileType: string;
    id: string;
    courseDesignId: string;
    name: string;
};
/**
 * 职教云网课
 *
 * 因为存在子 iframe 并且 ppt 跨域的情况
 * 所以采用新建小窗口的形式，通过子 window 以及 opener 的形式进行互相回调调用
 * 所以核心逻辑代码可能会比较绕。
 *
 * 为什么不在学习页面写脚本，而是 课程学习 和 学习页面 两个脚本进行交互运行？
 * 因为学习页面无法获取学习进度，这样可能导致已学课程重复学习。
 *
 */
export declare const ZJYProject: Project<{
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    v2: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    dispatcher: Script<{}, import("easy-us").ScriptConfigs, {
        dispatch: () => Promise<void>;
    }>;
    study: Script<{}, {
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
        pptReadPeriod: {
            label: string;
            defaultValue: number;
            attrs: {
                type: string;
                min: number;
                step: number;
                max: number;
            };
        };
        currentCourseId: {
            defaultValue: string;
        };
        courseList: {
            defaultValue: CourseType[];
        };
    }, {
        main: (type: 'classroomNow' | 'normal') => Promise<void>;
    }>;
    work: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, {
        main: () => Promise<void>;
    }>;
}>;
export {};
