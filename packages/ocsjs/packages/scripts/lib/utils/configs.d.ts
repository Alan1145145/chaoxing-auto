import { Config } from 'easy-us';
/**
 * 可复用的配置参数
 */
/**
 * 倍速设置
 */
export declare const playbackRate: Config;
/** 音量调节配置  */
export declare const volume: Config<any, number>;
/** 复习模式配置 */
export declare const restudy: Config<any, boolean>;
/** 清晰度配置 */
export declare const definition: Config<any, 'line1bq' | 'line1gq'>;
/** 开启自动答题 */
export declare const auto: Config<any, boolean>;
/** 答题提示 */
export declare const workNotes: Config<any, string>;
export declare const dropdownStyle: Omit<Config<any, string>, 'defaultValue'>;
