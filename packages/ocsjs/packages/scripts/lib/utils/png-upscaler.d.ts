/**
 * 纯 JS PNG 放大器（零依赖）。
 *
 * 用于图片题优化：当图片任意边 < 题库/模型最小尺寸（如豆包 14px）时，
 * 将图片最近邻放大到 ≥ 该尺寸，避免模型 400 拒绝。
 *
 * 环境分发：
 *   - Node（测试）：手写 PNG 解码（zlib inflate + 反过滤）→ 重采样 → 编码（filter 0 + zlib deflate）。
 *   - 浏览器（生产）：canvas 缩放。
 *
 * 仅处理 8 位、颜色类型 0/2/4/6（灰度/RGB/灰度Alpha/RGBA）的 PNG；
 * 其他（调色板、低位深）不放大，原样返回。
 */
interface PngInfo {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    channels: number;
}
/** 获取 PNG 尺寸（仅 8 位、颜色类型 0/2/4/6；否则 undefined） */
export declare function getImageSize(dataUrl: string): PngInfo | undefined;
/**
 * 放大过小图片使其任意边 ≥ minDim。
 * - Node：PNG 编解码路径。
 * - 浏览器：canvas 路径。
 * 已达标的图片原样返回；无法处理（非支持格式 / 失败）也原样返回。
 */
export declare function upscalePngDataUrl(dataUrl: string, minDim: number): Promise<string>;
export {};
