export declare const RenderScript: import("easy-us").Script<{}, {
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
