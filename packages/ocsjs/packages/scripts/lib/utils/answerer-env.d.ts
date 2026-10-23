export interface ImageSuggestionResult {
    /** base64 图片数组，顺序对应 [图片1]、[图片2]… */
    images: string[];
    /** 与 images 严格同序的图片原始 URL（[图片N] 还原的单一数据源，已跳过转换失败项） */
    urls: string[];
    /** 原题标题中图片 URL 替换为 [图片N] 占位符后的文本（不含 base64） */
    suggestion_title: string;
    /** 原选项中图片 URL 替换为 [图片N] 占位符后的文本（不含 base64），无图片时为 undefined */
    suggestion_options?: string;
}
/**
 * 将图片转换为 base64 字符串
 * 支持传入 URL 字符串或 HTMLImageElement
 * 优先使用 Canvas 方式（浏览器已携带认证信息加载图片，可绕过防盗链）
 * Canvas 失败时（跨域无 CORS 头导致画布被污染）回退到 GM_xmlhttpRequest
 */
export declare function imageToBase64(source: string | HTMLImageElement): Promise<string>;
export declare function createImageSuggestion(title: string, options?: string, 
/** DOM 调用方可直接传入按文档顺序的标题图片 URL，跳过正则提取 */
titleImages?: string[], 
/** DOM 调用方可直接传入按文档顺序的选项图片 URL，跳过正则提取 */
optionImages?: string[]): Promise<ImageSuggestionResult | undefined>;
export declare function buildAnswererEnv(params: {
    type?: string;
    title: string;
    /** 选项文本，支持字符串或字符串数组（数组会按行拼接为字符串） */
    options?: string | string[];
    /** DOM 调用方传入的标题图片 URL（跳过正则提取） */
    titleImages?: string[];
    /** DOM 调用方传入的选项图片 URL（跳过正则提取） */
    optionsImages?: string[];
    enableImageOptimize?: boolean;
    includeOcsAuthToken?: boolean;
}): Promise<{
    env: Record<string, any>;
    /** 与 env.images 严格同序的图片原始 URL（无图片时为空数组），供 [图片N] 还原直接使用 */
    imageUrls: string[];
}>;
/**
 * 题库配置是否支持图片题优化。
 *
 * 仅判定请求方法是否为 POST：GET 方法无法安全携带 base64 图片数据。
 *
 * 注意：本函数仅用于**提示**用户更新题库配置，不做任何限制。
 * 因为上传内容由题库配置的占位符决定，而原题 title / options 不再被覆盖，
 * 旧配置（只读 ${title} / ${options}）不会上传新增字段，因此即便返回 false 也是安全的。
 */
export declare function isAnswererWrappersSupportImageOptimize(wrappers: any[]): boolean;
