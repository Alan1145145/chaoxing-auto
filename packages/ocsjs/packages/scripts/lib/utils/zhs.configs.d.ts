import { Config } from 'easy-us';
/**
 * 智慧树学习脚本通用配置。
 *
 * 智慧树平台的多个学习脚本（共享课 / 新形态课程 / 校内课 / 新智慧学习 / AI 教学空间）已收敛到
 * 统一的命名空间 `zhs.study` 下，因此这些通用配置只需要在任意一个学习脚本中设置一次，
 * 即可在所有智慧树学习脚本中生效。
 */
/**
 * 智慧树学习倍速配置。
 * 说明：智慧树倍速最高只能 1.5x，超出存在封号风险，因此与 utils/configs 中的通用倍速配置（最高 16x）区分。
 */
export declare const playbackRate: Config;
/** 视频黑屏时自动刷新配置 */
export declare const reloadWhenError: Config;
/** 智慧树学习脚本统一使用提示（合并各平台公共提示） */
export declare const studyNotes: Config;
/** 智慧树作业考试脚本统一使用提示 */
export declare const workNotes: Config;
/** 作业答题开始延迟 */
export declare const workDelay: Config;
/** 共享课考前/作业须知阅读确认 */
export declare const readNotes: Config;
/** 共享课-学习脚本独有：定时停止（仅共享课系列学习页面生效） */
export declare const stopTime: Config;
/** 新形态课程-学习脚本独有：跳转模式（仅新形态课程学习页面生效） */
export declare const switchMode: Config;
/** 新智慧学习-学习脚本独有：忽略习惯分弹窗（仅新智慧学习页面生效） */
export declare const skipStudyTimeWarnDialog: Config;
/**
 * 学习设置中心统一展示的完整配置。
 * 各 key 虽然也会在被隐藏的运行脚本中声明，但因同属 `zhs.study` 命名空间，存储值完全一致，
 * 用户只需在设置中心修改一次即可。
 */
export declare const studyCenterConfigs: Record<string, Config>;
/**
 * 作业考试设置中心统一展示的完整配置。
 * 使用 `zhs.work` 命名空间。
 */
export declare const workCenterConfigs: Record<string, Config>;
