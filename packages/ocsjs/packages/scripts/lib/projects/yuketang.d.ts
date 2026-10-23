import { Project, Script } from 'easy-us';
export declare const YKTProject: Project<{
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
    global: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    ppt: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    /**
     * 旧版 v2/web 学习已废弃、目前大部分雨课堂主要为  ai-workspace， 其中存在区别： 部分 ai 课存在 AI学伴（右侧智能体功能）
     */
    ai: Script<{}, {
        notes: {
            defaultValue: string;
        };
        restudy: import("easy-us").Config<any, boolean>;
        problemWork: {
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
        discussMode: {
            label: string;
            tag: "select";
            defaultValue: "none" | "random" | "first";
            options: string[][];
        };
        volume: import("easy-us").Config<any, number>;
        playbackRate: {
            label: string;
            tag: "select";
            defaultValue: number;
            options: string[][];
        };
    }, import("easy-us").ScriptMethods>;
}>;
