"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdown = void 0;
const marked_1 = require("marked");
const dompurify_1 = __importDefault(require("dompurify"));
// 渲染出的链接统一新窗口打开，并禁止携带 opener 引用
dompurify_1.default.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});
/**
 * 渲染 markdown 为安全的 HTML
 *
 * marked 不会净化 HTML，远程内容（如 CDN 的更新日志）可能注入恶意 HTML/事件属性，
 * 必须使用 DOMPurify 消毒后再写入 innerHTML
 */
function markdown(md) {
    return dompurify_1.default.sanitize(marked_1.marked.parse(md), { ADD_ATTR: ['target'] });
}
exports.markdown = markdown;
