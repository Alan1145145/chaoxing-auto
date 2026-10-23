"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchElements = exports.FontDecryptor = exports.listFontFaces = exports.extractFontFromStyle = exports.findFontUrls = exports.collectChars = exports.decryptElements = exports.decryptText = exports.crackFont = exports.crackChar = exports.loadRefTable = void 0;
/**
 * 字体解密框架（字形置换类加密通用）
 *
 * 【架构说明】
 * 本目录为平台无关的底层框架，各平台（projects/*.ts）只需提供：
 *   1. 字体获取方式（data URI / 网络 URL）
 *   2. 加密元素选择器
 *   3. 对应字重的特征表地址
 * 即可复用同一套解密算法，例如：
 *
 * ```ts
 * import { crackFont, collectChars, decryptElements, extractFontFromStyle } from '../utils/font-decrypt';
 *
 * const buffer = extractFontFromStyle(document, 'font-cxsecret');
 * const els = Array.from(document.querySelectorAll('.font-cxsecret'));
 * const { map } = await crackFont(buffer, collectChars(els), {
 *   refTableUrl: 'https://cdn.ocsjs.com/resources/font/cx.bin'
 * });
 * decryptElements(els, map);
 * ```
 *
 * 【特征表】
 * 不同平台的加密字体可能基于不同字重设计，特征表按字重拆分以减小体积：
 *   - cx.bin   ：wght 350/400 字重（超星 SourceHanSansCN-Normal 设计）
 *   - yuketang.bin ：wght 250 字重（雨课堂 SourceHanSansSC-VF 默认实例）
 * 表为 FRB2 位打包格式（单平台约 0.76MB），由离线脚本一次性生成，
 * 与平台加密方式无关，无需随平台改字体而更新。
 */
__exportStar(require("./types"), exports);
var ref_table_1 = require("./ref-table");
Object.defineProperty(exports, "loadRefTable", { enumerable: true, get: function () { return ref_table_1.loadRefTable; } });
var bitmap_1 = require("./bitmap");
Object.defineProperty(exports, "crackChar", { enumerable: true, get: function () { return bitmap_1.crackChar; } });
Object.defineProperty(exports, "crackFont", { enumerable: true, get: function () { return bitmap_1.crackFont; } });
Object.defineProperty(exports, "decryptText", { enumerable: true, get: function () { return bitmap_1.decryptText; } });
Object.defineProperty(exports, "decryptElements", { enumerable: true, get: function () { return bitmap_1.decryptElements; } });
Object.defineProperty(exports, "collectChars", { enumerable: true, get: function () { return bitmap_1.collectChars; } });
Object.defineProperty(exports, "findFontUrls", { enumerable: true, get: function () { return bitmap_1.findFontUrls; } });
Object.defineProperty(exports, "extractFontFromStyle", { enumerable: true, get: function () { return bitmap_1.extractFontFromStyle; } });
Object.defineProperty(exports, "listFontFaces", { enumerable: true, get: function () { return bitmap_1.listFontFaces; } });
var decryptor_1 = require("./decryptor");
Object.defineProperty(exports, "FontDecryptor", { enumerable: true, get: function () { return decryptor_1.FontDecryptor; } });
Object.defineProperty(exports, "watchElements", { enumerable: true, get: function () { return decryptor_1.watchElements; } });
