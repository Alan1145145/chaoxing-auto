/**
 * 渲染 markdown 为安全的 HTML
 *
 * marked 不会净化 HTML，远程内容（如 CDN 的更新日志）可能注入恶意 HTML/事件属性，
 * 必须使用 DOMPurify 消毒后再写入 innerHTML
 */
export declare function markdown(md: string): string;
