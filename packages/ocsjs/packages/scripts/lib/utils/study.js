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
exports.waitFor = exports.waitForElement = exports.waitForMedia = void 0;
/**
 * 等待视频加载并获取视频
 */
function waitForMedia(options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const timeoutMs = (_a = options === null || options === void 0 ? void 0 : options.timeout) !== null && _a !== void 0 ? _a : 3 * 60 * 1000;
        const res = yield new Promise((resolve, reject) => {
            // eslint-disable-next-line prefer-const
            let timeoutId;
            const interval = setInterval(() => {
                const video = ((options === null || options === void 0 ? void 0 : options.root) || document).querySelector(`${(options === null || options === void 0 ? void 0 : options.videoSelector) || 'video'},${(options === null || options === void 0 ? void 0 : options.audioSelector) || 'audio'}`);
                if (video && (!(options === null || options === void 0 ? void 0 : options.filter) || options.filter(video))) {
                    clearInterval(interval);
                    if (timeoutId !== undefined) {
                        clearTimeout(timeoutId);
                    }
                    resolve(video);
                }
            }, 200);
            timeoutId = setTimeout(() => {
                clearInterval(interval);
                reject(new Error('视频/音频未找到，或者加载超时。'));
            }, timeoutMs);
        });
        return res;
    });
}
exports.waitForMedia = waitForMedia;
function waitForElement(selector, opts) {
    return waitFor(() => {
        return typeof selector === 'function' ? selector() : document.querySelector(selector);
    }, opts);
}
exports.waitForElement = waitForElement;
function waitFor(predicate, opts) {
    return new Promise((resolve, reject) => {
        let timeout;
        const interval = setInterval(() => {
            const result = predicate();
            if (result) {
                clearInterval(interval);
                timeout && clearTimeout(timeout);
                resolve(result);
            }
        }, (opts === null || opts === void 0 ? void 0 : opts.check_period_ms) || 1000);
        // 超时跳过
        if (opts === null || opts === void 0 ? void 0 : opts.timeout_seconds) {
            timeout = setTimeout(() => {
                clearInterval(interval);
                resolve(undefined);
            }, ((opts === null || opts === void 0 ? void 0 : opts.timeout_seconds) || 10) * 1000);
        }
    });
}
exports.waitFor = waitFor;
