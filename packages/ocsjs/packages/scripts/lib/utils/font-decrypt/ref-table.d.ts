import type { RefTable } from './types';
/** 加载参考特征表（同一 URL 只加载一次；失败后清除缓存允许下次重试） */
export declare function loadRefTable(url: string): Promise<RefTable>;
