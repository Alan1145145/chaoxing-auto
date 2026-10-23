import type { CrackResult, FontDecryptConfig, RefTable } from './types';
/** 单字符的两级最近邻匹配 */
export declare function crackChar(table: RefTable, feat: {
    coarse: Uint8Array;
    fine: Uint8Array;
}): {
    ch: string;
    best: number;
    second: number;
    margin: number;
};
/**
 * 破解加密字体，返回 密文字 -> 真实字 映射。
 *
 * @param fontSource 字体来源：URL 或 ArrayBuffer（FontFace 原生支持 ttf/otf/woff/woff2）
 * @param chars      需要破解的字符集合（通常取加密区域的全部文本去重即可，
 *                   无需破解整个字表；未提供的字符在解密时按原样保留）
 * @param config     平台解密配置（特征表地址、字重锁定等）
 */
export declare function crackFont(fontSource: string | ArrayBuffer, chars: string | string[], config: FontDecryptConfig): Promise<CrackResult>;
/** 用映射表解密一段文本（未破解过的字符按原样保留） */
export declare function decryptText(text: string, map: Record<string, string>): string;
/**
 * 用映射表原地解密元素内所有文本节点。
 * 只改文本节点内容，不触碰 HTML 结构，避免 innerHTML 替换破坏事件绑定。
 */
export declare function decryptElements(roots: Element | Element[], map: Record<string, string>): void;
/**
 * 收集元素内出现的去重字符集（作为 crackFont 的 chars 入参，
 * 只破解页面实际出现的字符，比全字表破解快几个数量级）。
 */
export declare function collectChars(roots: Element | Element[]): string;
/** 在页面中查找字体文件 URL（@font-face 规则 + 资源加载记录） */
export declare function findFontUrls(doc?: Document): string[];
/** 从 @font-face 的 data URI 中提取 base64 字体数据并解码为 ArrayBuffer */
export declare function extractFontFromStyle(doc: Document, fontFamilyMarker: string): ArrayBuffer | undefined;
/** 页面 @font-face 声明（族名 + 字体源） */
export interface FontFaceInfo {
    /** font-family 名称 */
    family: string;
    /** 字体源：网络 URL 或 data URI（可直接作为 crackFont 的 fontSource） */
    src: string;
}
/**
 * 列出页面中所有 @font-face 声明（族名 + src）。
 * 用于"一页多字体"场景：不同元素可能使用不同置换表生成的字体，
 * 需要按 font-family 分组后分别破解。
 */
export declare function listFontFaces(doc?: Document): FontFaceInfo[];
