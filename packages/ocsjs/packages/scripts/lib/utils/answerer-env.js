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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnswererWrappersSupportImageOptimize = exports.buildAnswererEnv = exports.createImageSuggestion = exports.imageToBase64 = void 0;
const png_upscaler_1 = require("./png-upscaler");
const core_1 = require("@ocsjs/core");
/** 是否运行在 Node 环境（非浏览器 / 非油猴脚本） */
function isNodeEnv() {
    var _a;
    return (typeof process !== 'undefined' &&
        !!((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node) &&
        globalThis.GM_xmlhttpRequest === undefined);
}
/** Node 下用 node-fetch 拉取图片并转为 data URL（base64） */
function nodeFetchToBase64(url) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fet = require('node-fetch').default || require('node-fetch');
        // 携带 Referer / User-Agent 绕过防盗链（如 chaoxing 403）
        let referer = '';
        try {
            referer = new URL(url).origin + '/';
        }
        catch (_a) {
            // 非 URL，忽略
        }
        const res = yield fet(url, {
            headers: {
                Referer: referer,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) {
            throw new Error(`图片下载失败 ${res.status}`);
        }
        // node-fetch v2 支持 .buffer()
        const buffer = res.buffer ? res.buffer() : res.arrayBuffer();
        const buf = buffer instanceof Promise ? yield buffer : buffer;
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${buf.toString('base64')}`;
    });
}
/**
 * URL → base64 会话级缓存（LRU）。
 * 同一份试卷中公式图常在多题间复用，重试/重新答题也会重复请求同一批图片，
 * 命中缓存可跳过网络下载与 Canvas 转换。
 */
const IMAGE_BASE64_CACHE_MAX = 200;
const imageBase64Cache = new Map();
let localOcsAuthToken = '';
let localOcsAuthTokenExpiresAt = 0;
let localOcsAuthTokenPending;
function getLocalOcsAuthToken() {
    return __awaiter(this, void 0, void 0, function* () {
        if (localOcsAuthToken && Date.now() < localOcsAuthTokenExpiresAt)
            return localOcsAuthToken;
        if (localOcsAuthTokenPending)
            return localOcsAuthTokenPending;
        localOcsAuthTokenPending = (0, core_1.request)('http://localhost:15319/get-actions-key', {
            type: 'GM_xmlhttpRequest',
            method: 'get',
            responseType: 'text'
        })
            .then((token) => String(token || '').trim())
            .catch(() => '');
        localOcsAuthToken = yield localOcsAuthTokenPending;
        localOcsAuthTokenExpiresAt = Date.now() + 15000;
        localOcsAuthTokenPending = undefined;
        return localOcsAuthToken;
    });
}
/**
 * 将图片转换为 base64 字符串
 * 支持传入 URL 字符串或 HTMLImageElement
 * 优先使用 Canvas 方式（浏览器已携带认证信息加载图片，可绕过防盗链）
 * Canvas 失败时（跨域无 CORS 头导致画布被污染）回退到 GM_xmlhttpRequest
 */
function imageToBase64(source) {
    const url = typeof source === 'string' ? source : source.src;
    // data URL 本身已是 base64 且键过长，不参与缓存
    if (url && !url.startsWith('data:')) {
        const cached = imageBase64Cache.get(url);
        if (cached) {
            // LRU：命中后刷新为最新插入位置
            imageBase64Cache.delete(url);
            imageBase64Cache.set(url, cached);
            return Promise.resolve(cached);
        }
        return convertImageToBase64(source).then((b64) => {
            if (imageBase64Cache.size >= IMAGE_BASE64_CACHE_MAX) {
                // 删除最老条目（Map 按插入顺序迭代）
                imageBase64Cache.delete(imageBase64Cache.keys().next().value);
            }
            imageBase64Cache.set(url, b64);
            return b64;
        });
    }
    return convertImageToBase64(source);
}
exports.imageToBase64 = imageToBase64;
/** 实际的图片转 base64 实现（不经过缓存，由 {@link imageToBase64} 调用） */
function convertImageToBase64(source) {
    return new Promise((resolve, reject) => {
        // 如果是 HTMLImageElement，直接用 Canvas 绘制转换
        if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
            // 已经是 data URL，直接返回
            if (source.src.startsWith('data:')) {
                resolve(source.src);
                return;
            }
            try {
                const canvas = document.createElement('canvas');
                canvas.width = source.naturalWidth;
                canvas.height = source.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(source, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
                return;
            }
            catch (_a) {
                // Canvas 被污染（跨域无 CORS），回退到 GM_xmlhttpRequest
            }
        }
        // URL 字符串或 Canvas 回退：尝试通过 crossOrigin="anonymous" 加载图片再用 Canvas 转换
        const url = typeof source === 'string' ? source : source.src;
        // 已经是 data URL，直接返回
        if (url.startsWith('data:')) {
            resolve(url);
            return;
        }
        // Node 环境：直接拉取图片字节转 base64
        if (isNodeEnv()) {
            nodeFetchToBase64(url).then(resolve, reject);
            return;
        }
        // 浏览器环境：尝试设置 crossOrigin 加载图片 + Canvas 转换
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            }
            catch (_a) {
                // Canvas 失败，回退到 GM_xmlhttpRequest
                gmXmlHttpRequestFallback(url, resolve, reject);
            }
        };
        img.onerror = () => {
            // 图片加载失败（CORS 阻止），回退到 GM_xmlhttpRequest
            gmXmlHttpRequestFallback(url, resolve, reject);
        };
        img.src = url;
    });
}
/** GM_xmlhttpRequest 回退方案，忽略跨域限制 */
function gmXmlHttpRequestFallback(url, resolve, reject) {
    if (typeof GM_xmlhttpRequest === 'undefined') {
        reject(new Error('图片转 base64 失败'));
        return;
    }
    // eslint-disable-next-line no-undef
    GM_xmlhttpRequest({
        url,
        method: 'GET',
        responseType: 'blob',
        onload: (response) => {
            const blob = response.response;
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        },
        onerror: reject
    });
}
/**
 * 将任意 data URL（可能含 charset 等参数、或非 png mime）统一为 data:image/png;base64,{b64} 格式。
 * 仅重写前缀与 mime，不转换图片字节。
 */
function normalizeToPngDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:[^;,]+.*?;base64,(.+)$/);
    return `data:image/png;base64,${m ? m[1] : dataUrl}`;
}
/** 图片最小边长阈值：低于此值的图片会被题库/模型（如豆包 14px）拒绝，需放大后再提交 */
const MIN_IMAGE_DIMENSION = 14;
function createImageSuggestion(title, options, 
/** DOM 调用方可直接传入按文档顺序的标题图片 URL，跳过正则提取 */
titleImages, 
/** DOM 调用方可直接传入按文档顺序的选项图片 URL，跳过正则提取 */
optionImages) {
    return __awaiter(this, void 0, void 0, function* () {
        // 匹配图片 URL：非贪婪且排除中文/全角字符，避免跨越多个 URL 或中文文本拼成非法 URL
        const imageUrlRegex = /https?:\/\/[^\s一-鿿＀-￯]+?\.(?:png|jpe?g|gif|bmp|webp|svg)(?:\?[^\s一-鿿＀-￯]*)?/gi;
        // 收集标题和选项中的所有图片 URL，保持顺序
        // 若调用方提供 images 数组则直接使用（DOM 遍历所得，跳过正则）；否则回退到正则提取（字符串输入场景）
        const titleUrls = titleImages && titleImages.length ? titleImages.slice() : title.match(imageUrlRegex) || [];
        const optionUrls = optionImages && optionImages.length ? optionImages.slice() : (options === null || options === void 0 ? void 0 : options.match(imageUrlRegex)) || [];
        if (titleUrls.length === 0 && optionUrls.length === 0)
            return undefined;
        // 去重，保持顺序
        const allUrls = [];
        const seen = new Set();
        for (const url of [...titleUrls, ...optionUrls]) {
            if (!seen.has(url)) {
                seen.add(url);
                allUrls.push(url);
            }
        }
        // 并行转换所有图片为 base64
        const base64Map = new Map();
        yield Promise.all(allUrls.map((url) => __awaiter(this, void 0, void 0, function* () {
            try {
                const base64 = yield imageToBase64(url);
                base64Map.set(url, base64);
            }
            catch (_a) {
                // 转换失败的图片跳过
            }
        })));
        if (base64Map.size === 0)
            return undefined;
        // 构建 URL → [图片N] 的映射，同时按顺序收集 base64 数组
        // 按 allUrls（题目/选项中的出现顺序）遍历，而非下载完成顺序，保证编号与原文一致
        // 占位符左右各加两个空格，与相邻中文/符号分隔，便于题库解析
        const images = [];
        const urls = [];
        const placeholderMap = new Map();
        for (const url of allUrls) {
            const base64 = base64Map.get(url);
            if (!base64)
                continue;
            // 统一为 data:image/png;base64,{b64} 格式，去除 charset 等参数与原始 mime 差异
            let normalized = normalizeToPngDataUrl(base64);
            // 过小图片放大到 ≥ MIN_IMAGE_DIMENSION，避免模型（如豆包 14px）拒绝
            const size = (0, png_upscaler_1.getImageSize)(normalized);
            if (size && (size.width < MIN_IMAGE_DIMENSION || size.height < MIN_IMAGE_DIMENSION)) {
                try {
                    normalized = yield (0, png_upscaler_1.upscalePngDataUrl)(normalized, MIN_IMAGE_DIMENSION);
                }
                catch (e) {
                    console.warn(`[imageOptimize] 图片 ${size.width}x${size.height} 放大失败，已跳过：${url}（${e === null || e === void 0 ? void 0 : e.message}）`);
                    continue;
                }
            }
            placeholderMap.set(url, ` [图片${images.length + 1}] `);
            images.push(normalized);
            urls.push(url);
        }
        if (images.length === 0)
            return undefined;
        // 标题：URL 替换为 [图片N] 占位符（不含 base64）
        let suggestionTitle = title;
        for (const [url, placeholder] of placeholderMap) {
            suggestionTitle = suggestionTitle.split(url).join(placeholder);
        }
        // 选项：URL 替换为 [图片N] 占位符（不含 base64），仅当选项含图片时返回
        let suggestionOptions;
        if (options) {
            const hasOptionImages = optionUrls.some((url) => base64Map.has(url));
            if (hasOptionImages) {
                suggestionOptions = options;
                for (const [url, placeholder] of placeholderMap) {
                    suggestionOptions = suggestionOptions.split(url).join(placeholder);
                }
            }
        }
        return Object.assign({ images,
            urls, suggestion_title: suggestionTitle }, (suggestionOptions !== undefined ? { suggestion_options: suggestionOptions } : {}));
    });
}
exports.createImageSuggestion = createImageSuggestion;
/** 按行去重字符串，保持首次出现的顺序 */
function dedupeLines(str) {
    const seen = new Set();
    const result = [];
    for (const line of str.split('\n')) {
        if (!seen.has(line)) {
            seen.add(line);
            result.push(line);
        }
    }
    return result.join('\n');
}
function buildAnswererEnv(params) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // options 归一化为字符串：数组按行拼接，保证后续占位符替换与图片匹配均为字符串处理
        const rawOptions = Array.isArray(params.options)
            ? params.options.filter((o) => o != null && o !== '').join('\n')
            : (_a = params.options) !== null && _a !== void 0 ? _a : '';
        // options 按行去重（保持顺序）
        const options = dedupeLines(rawOptions);
        // 原题 title / options 始终保留，不做覆盖与修改
        const env = {
            type: params.type || 'unknown',
            title: params.title,
            options
        };
        if (params.includeOcsAuthToken)
            env.ocsAuthToken = yield getLocalOcsAuthToken();
        let imageUrls = [];
        if (params.enableImageOptimize) {
            const suggestion = yield createImageSuggestion(params.title, options, params.titleImages, params.optionsImages);
            if (suggestion) {
                // 新增独立字段，由题库配置（v2）显式引用后才会被提交
                // 注意：env.images 不做内容去重——[图片N] 占位符编号与 images 顺序严格对应，
                // 按 base64 内容去重会破坏对齐（服务端 dedupQuestionData 已有带重映射的去重）。
                env.images = suggestion.images;
                imageUrls = suggestion.urls;
                env.suggestion_title = suggestion.suggestion_title;
                if (suggestion.suggestion_options !== undefined) {
                    env.suggestion_options = dedupeLines(suggestion.suggestion_options);
                }
            }
        }
        return { env, imageUrls };
    });
}
exports.buildAnswererEnv = buildAnswererEnv;
/**
 * 题库配置是否支持图片题优化。
 *
 * 仅判定请求方法是否为 POST：GET 方法无法安全携带 base64 图片数据。
 *
 * 注意：本函数仅用于**提示**用户更新题库配置，不做任何限制。
 * 因为上传内容由题库配置的占位符决定，而原题 title / options 不再被覆盖，
 * 旧配置（只读 ${title} / ${options}）不会上传新增字段，因此即便返回 false 也是安全的。
 */
function isAnswererWrappersSupportImageOptimize(wrappers) {
    return wrappers.some((w) => w && String(w.method || 'get').toLowerCase() === 'post');
}
exports.isAnswererWrappersSupportImageOptimize = isAnswererWrappersSupportImageOptimize;
