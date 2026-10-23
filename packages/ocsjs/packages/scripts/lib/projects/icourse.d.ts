import { Project, Script } from 'easy-us';
export declare const ICourseProject: Project<{
    dispatcher: Script<{}, import("easy-us").ScriptConfigs, import("easy-us").ScriptMethods>;
    guide: Script<{}, {
        notes: {
            defaultValue: string;
        };
        runAtHash: {
            defaultValue: string[];
        };
    }, {
        main: () => Promise<void>;
    }>;
    study: Script<{}, {
        notes: {
            defaultValue: string;
        };
        runAtHash: {
            defaultValue: string;
        };
        playbackRate: import("easy-us").Config<keyof import("easy-us/lib/elements/configs/interface").ConfigTagMap, any>;
        volume: import("easy-us").Config<any, number>;
        readSpeed: {
            label: string;
            attrs: {
                type: string;
                step: string;
                min: string;
                max: string;
            };
            defaultValue: number;
        };
        discussionStrategy: {
            label: string;
            tag: "select";
            defaultValue: "not-reply" | "max-show-up" | "max-fav" | "use-newest";
            options: string[][];
        };
        enableChapterTest: {
            label: string;
            attrs: {
                type: string;
                title: string;
            };
            defaultValue: boolean;
        };
    }, import("easy-us").ScriptMethods>;
    work: Script<{}, {
        notes: {
            defaultValue: string;
        };
        runAtHash: {
            defaultValue: string[];
        };
    }, {
        main: ({ canRun }: {
            canRun: () => boolean;
            job_id: string;
        }) => Promise<void>;
        start: (type: 'chapter-test' | 'work' | 'exam', canRun: () => boolean, onWorkerCreated?: ((worker: any) => void) | undefined) => Promise<void>;
    }>;
    passportRedirect: Script<{}, {
        notes: {
            defaultValue: string;
        };
    }, import("easy-us").ScriptMethods>;
}>;
