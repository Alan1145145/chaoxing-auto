export type MetaDataType = string | string[];
/**
 * 脚本头部信息格式
 */
export interface MetaDataFormatter {
    header: string;
    footer: string;
    prefix: string;
    symbol: string;
    gap: string;
}
/**
 * 脚本头部信息
 */
export interface Metadata {
    [x: string]: any;
    name: string;
    version: string;
    description: string;
    author: MetaDataType;
    license: string;
    namespace: string;
    homepage: string;
    source: string;
    icon: string;
    connect: MetaDataType;
    match: MetaDataType;
    grant: MetaDataType;
    require: MetaDataType;
    resource: MetaDataType;
    'run-at': 'document-start' | 'document-end' | 'document-idle' | 'document-body' | 'document-body';
}
/**
 * 创建脚本参数
 */
export interface CreateOptions {
    parseRequire: boolean;
    parseResource: boolean;
    resourceBuilder: (key: string, value: string) => string;
    metaDataFormatter: MetaDataFormatter;
    entry: string;
    dist: string;
    metadata: Metadata;
}
export declare const DEFAULT_METADATA: Partial<Metadata>;
/**
 * 创建脚本头部信息
 * @param metadata
 * @returns
 */
export declare function createUserScriptMetadata(formatter: MetaDataFormatter, metadata: Metadata): string;
/**
 * 解析脚本头部信息
 * @param require 外部依赖
 */
export declare function parseMetaDataRequires(require?: Metadata['require']): Promise<string>;
/**
 * 解析脚本头部信息
 * @param resource 资源信息
 * @param resourceBuilder 变量声明器
 */
export declare function parseMetaDataResources(resource: MetaDataType | undefined, resourceBuilder: (key: string, value: string) => string): Promise<string>;
/**
 * 创建 META 信息文件
 * 解析用户脚本中的 ==UserScript== 头部信息，生成仅包含 META 信息的 meta.js 文件
 * @param opts.dist 用户脚本文件路径
 * @param opts.metaDist meta.js 文件输出路径，默认基于 dist 替换后缀为 .meta.js
 */
export declare function createMetaFile(opts: {
    dist: string;
    metaDist?: string;
}): Promise<void>;
/**
 * 创建用户脚本
 */
export declare function createUserScript(opts: CreateOptions): Promise<void>;
