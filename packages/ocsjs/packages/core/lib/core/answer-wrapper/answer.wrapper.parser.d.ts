import { AnswererWrapper } from './interface';
/**
 * 解析题库配置 数据来源可以是 base64 , json , json-string
 */
export declare class AnswerWrapperParser {
    /** 从 json 字符串中解析 */
    static fromObject(json: any): AnswererWrapper[];
    static fromJSONString(json: string): any;
    /** 从 base64 解析 */
    static fromBase64(base64: string): any;
    /**
     * 解析题库配置 数据来源可以是 base64 , json , json-string
     */
    static from(value: any): AnswererWrapper[];
}
