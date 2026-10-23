import type { AnswererWrapper } from '@ocsjs/core';
/** 风险命中项 */
export interface HandlerRiskFinding {
    /** 命中的位置（handler 解析器 / data.xxx 字段解析器） */
    where: string;
    /** 命中的代码特征 */
    feature: string;
    /** 风险说明 */
    reason: string;
}
/**
 * 检测单段 handler 代码中的风险特征
 * （启发式语法检测，可能存在漏报/误报，仅用于风险提示，不阻断执行）
 */
export declare function detectHandlerRisks(code: string, where?: string): HandlerRiskFinding[];
/** 扫描题库配置中所有可执行代码字段（handler 与 data.*.handler） */
export declare function scanAnswerWrapperRisks(aw: AnswererWrapper): HandlerRiskFinding[];
/**
 * 检测题库配置中的风险代码，若存在则弹窗警告，由用户决定是否继续使用。
 * 手动粘贴与一键获取流程统一在保存前调用。
 *
 * @returns 无风险或用户确认继续使用时返回 true，用户取消时返回 false
 */
export declare function confirmRiskyAnswerWrappers(aws: AnswererWrapper[]): Promise<boolean>;
