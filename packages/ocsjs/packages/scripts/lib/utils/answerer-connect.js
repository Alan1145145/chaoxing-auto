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
exports.waitForAnswererConfig = exports.openAnswererConnect = exports.getAnswererConfigProvider = exports.setAnswererConfigProvider = exports.ANSWERER_CONNECT_PROTOCOL_VERSION = exports.ANSWERER_CONNECT_MESSAGE_TYPE = void 0;
const core_1 = require("@ocsjs/core");
/**
 * 题库配置一键获取（postMessage 回传方案）
 *
 * 流程：
 * 1. 用户在「题库配置」弹窗中点击一键获取按钮，脚本 window.open 题库站连接页（小窗）
 * 2. 用户在题库站完成登录（如已登录则直接授权），题库站连接页向 opener 推送配置
 * 3. 脚本校验消息来源（窗口 + 域名 + 协议）后解析并保存配置
 * 4. 配置读取成功后由调用方展示倒计时提示，并延迟自动关闭题库站小窗
 *
 * 题库站侧对接约定（协议 version 1）：
 * 连接页在用户登录后执行：
 *   window.opener?.postMessage({
 *     type: 'ocs-answerer-config',
 *     version: 1,
 *     config: [ /* AnswererWrapper[] *\/ ]
 *   }, '*');
 * 注意：opener 为用户所在的网课站页面，域名不可预知，因此 targetOrigin 只能为 '*'，
 * 安全性由 OCS 侧的 origin 精确校验保证（见 waitForAnswererConfig）。
 */
exports.ANSWERER_CONNECT_MESSAGE_TYPE = 'ocs-answerer-config';
exports.ANSWERER_CONNECT_PROTOCOL_VERSION = 1;
let provider;
/** 由入口脚本（entry.js）设置，未设置或参数非法时一键获取入口不显示 */
function setAnswererConfigProvider(p) {
    provider = undefined;
    if (p && p.name && p.connectUrl) {
        try {
            const url = new URL(p.connectUrl);
            if (url.protocol === 'https:' || url.protocol === 'http:') {
                provider = p;
            }
        }
        catch (_a) {
            // connectUrl 非法，忽略
        }
    }
}
exports.setAnswererConfigProvider = setAnswererConfigProvider;
function getAnswererConfigProvider() {
    return provider;
}
exports.getAnswererConfigProvider = getAnswererConfigProvider;
/**
 * 打开题库站连接页小窗。
 * 必须在用户点击回调内同步调用，否则会被浏览器弹窗拦截。
 */
function openAnswererConnect() {
    if (!provider)
        return null;
    // v1：拼接 ?from= 当前课程页 origin，作为题库站识别 opener 来源的首要依据
    // （雨课堂等 Referrer-Policy: no-referrer 站点下 document.referrer 为空，缺失时只能走手动复制）
    const connectUrl = new URL(provider.connectUrl);
    connectUrl.searchParams.set('from', location.origin);
    const width = 980;
    const height = 720;
    const left = Math.max(0, (screen.width - width) / 2);
    const top = Math.max(0, (screen.height - height) / 2);
    return window.open(connectUrl.toString(), 'ocs_answerer_connect', `width=${width},height=${height},left=${left},top=${top}`);
}
exports.openAnswererConnect = openAnswererConnect;
/**
 * 挂载一次性 message 监听，等待题库站连接页推送配置。
 *
 * 三重来源校验：
 * 1. e.source === win      —— 消息必须来自本函数对应的小窗（防止页面内 iframe 伪造）
 * 2. e.origin === origin   —— 与 connectUrl 的 origin 精确一致（防止其它域名伪造）
 * 3. 协议类型与版本匹配    —— 防止无关消息误处理
 *
 * 同时轮询小窗关闭与整体超时，失败时 reject，由调用方恢复手动配置入口。
 *
 * 边缘状态处理（自动关闭授权小窗）：
 * - 页面关闭/刷新（pagehide）时自动关闭小窗，避免遗留孤立授权页
 * - isAborted 返回 true（如配置弹窗被关闭）时自动关闭小窗并取消等待
 */
function waitForAnswererConfig(win, timeoutMs = 10 * 60000, isAborted) {
    if (!provider)
        return Promise.reject(new Error('未配置题库获取渠道'));
    const expectedOrigin = new URL(provider.connectUrl).origin;
    return new Promise((resolve, reject) => {
        let finished = false;
        /** 安全关闭授权小窗（浏览器仅允许关闭由脚本 window.open 打开的窗口） */
        const closeWin = () => {
            try {
                win.close();
            }
            catch (_a) {
                // 小窗可能已被用户手动关闭，忽略
            }
        };
        const cleanup = () => {
            finished = true;
            clearTimeout(timer);
            clearInterval(poller);
            window.removeEventListener('message', onMessage);
            window.removeEventListener('pagehide', closeWin);
        };
        const fail = (msg) => {
            if (!finished) {
                cleanup();
                reject(new Error(msg));
            }
        };
        const onMessage = (e) => __awaiter(this, void 0, void 0, function* () {
            if (finished || e.source !== win || e.origin !== expectedOrigin)
                return;
            const d = e.data;
            if (!d || d.type !== exports.ANSWERER_CONNECT_MESSAGE_TYPE || d.version !== exports.ANSWERER_CONNECT_PROTOCOL_VERSION) {
                return;
            }
            try {
                // 复用标准解析器校验：兼容数组 / JSON 字符串（已不支持远程订阅链接）
                const aws = (yield core_1.AnswerWrapperParser.from(d.config));
                cleanup();
                resolve(aws);
            }
            catch (err) {
                cleanup();
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
        const timer = setTimeout(() => fail('获取题库配置超时，请重试或使用手动配置。'), timeoutMs);
        const poller = setInterval(() => {
            if (win.closed) {
                fail('题库网站窗口已被关闭，请重试或使用手动配置。');
            }
            else if (isAborted === null || isAborted === void 0 ? void 0 : isAborted()) {
                // 配置弹窗被关闭（用户点击关闭/清空等）：自动关闭授权小窗并取消等待
                closeWin();
                fail('题库配置弹窗已关闭，获取已取消。');
            }
        }, 1000);
        window.addEventListener('message', onMessage);
        // 页面关闭/刷新时自动关闭授权小窗
        window.addEventListener('pagehide', closeWin);
    });
}
exports.waitForAnswererConfig = waitForAnswererConfig;
