/**
 * 发起请求
 * @param url 请求地址
 * @param opts 请求参数
 */
export declare function request<T extends 'json' | 'text'>(url: string, opts: {
    type: 'fetch' | 'GM_xmlhttpRequest';
    method?: 'get' | 'post' | 'head';
    responseType?: T;
    headers?: Record<string, string>;
    data?: Record<string, any>;
    /**
     * 状态探测场景：收到任何 HTTP 状态码都不 reject，
     * 统一 resolve `{ status: number, responseText: string }`（仅网络错误才 reject）。
     * 不传时保持原行为（GM 分支仅 200 resolve，fetch 分支不校验状态码）。
     */
    anyStatus?: boolean;
}): Promise<T extends 'json' ? any : string>;
