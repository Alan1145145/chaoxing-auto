import type { CrackResult, FontDecryptConfig, RefTable } from './types';
/**
 * 尝试在 Worker 中破解字体。
 * 返回 null 表示 Worker 通道不可用（调用方应回退主线程路径）。
 *
 * 注意：特征表通过 postMessage 结构化克隆传入（约 7MB，一次性开销），
 * 不能使用 transfer——特征表有全局缓存，transfer 会置空缓存数组。
 */
export declare function crackFontInWorker(fontSource: string | ArrayBuffer, chars: string[], config: FontDecryptConfig, table: RefTable): Promise<CrackResult | null>;
