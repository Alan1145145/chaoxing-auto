"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserScript = exports.createMetaFile = exports.parseMetaDataResources = exports.parseMetaDataRequires = exports.createUserScriptMetadata = exports.DEFAULT_METADATA = void 0;
var fs_1 = require("fs");
var node_fetch_1 = __importDefault(require("node-fetch"));
exports.DEFAULT_METADATA = {
    name: 'New Userscript',
    version: '0.1',
    description: 'try to take over the world!',
    author: ['You'],
    license: 'MIT',
    match: ['http://*/*'],
    grant: 'none',
    'run-at': 'document-idle'
};
/**
 * 创建脚本头部信息
 * @param metadata
 * @returns
 */
function createUserScriptMetadata(formatter, metadata) {
    var contents = [];
    // 最长字段
    var maxLength = Object.keys(metadata).reduce(function (pre, cur) { return Math.max(cur.length, pre); }, 0);
    var lineBuilder = function (key, value) {
        return [formatter.symbol, key.padEnd(maxLength, ' '), formatter.gap, value || ''].join('');
    };
    var _loop_1 = function (key) {
        if (Object.prototype.hasOwnProperty.call(metadata, key)) {
            var element = metadata[key];
            if (Array.isArray(element)) {
                contents.push.apply(contents, element.map(function (el) { return lineBuilder(key, el); }));
            }
            else {
                contents.push(lineBuilder(key, element));
            }
        }
    };
    for (var key in metadata) {
        _loop_1(key);
    }
    return __spreadArray(__spreadArray([formatter.header], contents, true), [formatter.footer], false).map(function (line) { return formatter.prefix + line; }).join('\n');
}
exports.createUserScriptMetadata = createUserScriptMetadata;
/**
 * 解析脚本头部信息
 * @param require 外部依赖
 */
function parseMetaDataRequires(require) {
    if (require === void 0) { require = []; }
    return __awaiter(this, void 0, void 0, function () {
        var requires, _i, _a, value, text, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    requires = [];
                    _i = 0, _a = Array.isArray(require) ? require : [require];
                    _c.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    value = _a[_i];
                    if (!value) return [3 /*break*/, 5];
                    if (!value.startsWith('http')) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, node_fetch_1.default)(value).then(function (res) { return res.text(); })];
                case 2:
                    _b = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _b = (0, fs_1.readFileSync)(value).toString();
                    _c.label = 4;
                case 4:
                    text = _b;
                    requires.push(text);
                    _c.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, requires.join('\n')];
            }
        });
    });
}
exports.parseMetaDataRequires = parseMetaDataRequires;
/**
 * 解析脚本头部信息
 * @param resource 资源信息
 * @param resourceBuilder 变量声明器
 */
function parseMetaDataResources(resource, resourceBuilder) {
    if (resource === void 0) { resource = []; }
    return __awaiter(this, void 0, void 0, function () {
        var resources, _i, _a, line, values, text, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    resources = [];
                    _i = 0, _a = Array.isArray(resource) ? resource : [resource];
                    _c.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    line = _a[_i];
                    values = line.replace(/ /g, ' ').split(' ');
                    if (!values[1].startsWith('http')) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, node_fetch_1.default)(values[1]).then(function (res) { return res.text(); })];
                case 2:
                    _b = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _b = (0, fs_1.readFileSync)(values[1]).toString();
                    _c.label = 4;
                case 4:
                    text = _b;
                    resources.push(resourceBuilder(values[0], text));
                    _c.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, resources.join('\n')];
            }
        });
    });
}
exports.parseMetaDataResources = parseMetaDataResources;
/**
 * 创建 META 信息文件
 * 解析用户脚本中的 ==UserScript== 头部信息，生成仅包含 META 信息的 meta.js 文件
 * @param opts.dist 用户脚本文件路径
 * @param opts.metaDist meta.js 文件输出路径，默认基于 dist 替换后缀为 .meta.js
 */
function createMetaFile(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var content, metaMatch, metaContent, metaDist;
        return __generator(this, function (_a) {
            content = (0, fs_1.readFileSync)(opts.dist).toString();
            metaMatch = content.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
            if (!metaMatch) {
                throw new Error('META information not found in ' + opts.dist);
            }
            metaContent = metaMatch[0];
            metaDist = opts.metaDist || opts.dist.replace(/\.user\.js$/, '.meta.js');
            return [2 /*return*/, (0, fs_1.writeFileSync)(metaDist, metaContent)];
        });
    });
}
exports.createMetaFile = createMetaFile;
/**
 * 创建用户脚本
 */
function createUserScript(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var requires, resources, content;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    requires = '';
                    resources = '';
                    if (!opts.parseRequire) return [3 /*break*/, 2];
                    return [4 /*yield*/, parseMetaDataRequires(opts.metadata.require)];
                case 1:
                    // 解析外部依赖
                    requires = _a.sent();
                    opts.metadata.require = [];
                    _a.label = 2;
                case 2:
                    if (!opts.parseResource) return [3 /*break*/, 4];
                    return [4 /*yield*/, parseMetaDataResources(opts.metadata.resource, opts.resourceBuilder)];
                case 3:
                    // 解析资源文件
                    resources = _a.sent();
                    opts.metadata.resource = [];
                    _a.label = 4;
                case 4:
                    content = [
                        // 创建脚本头部信息
                        createUserScriptMetadata(opts.metaDataFormatter, Object.assign(exports.DEFAULT_METADATA, opts.metadata)),
                        requires,
                        resources,
                        // 合并入口文件
                        (0, fs_1.readFileSync)(opts.entry).toString()
                    ].join('\n'.repeat(2));
                    (0, fs_1.writeFileSync)(opts.dist, content);
                    return [2 /*return*/];
            }
        });
    });
}
exports.createUserScript = createUserScript;
