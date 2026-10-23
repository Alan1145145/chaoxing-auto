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
exports.RemotePlaywright = void 0;
const utils_1 = require("../core/utils");
const common_1 = require("./common");
const easy_us_1 = require("easy-us");
const ListOfActions = [
    'click',
    'check',
    'dblclick',
    'bringToFront',
    'dragAndDrop',
    'fill',
    'focus',
    'hover',
    'inputValue',
    'screenshot',
    'selectOption',
    'setInputFiles',
    'tap',
    'press',
    'reload',
    'waitForRequest',
    'waitForResponse',
    'waitForSelector',
    'keyboard.type',
    'keyboard.press',
    'mouse.wheel',
    'mouse.click',
    'mouse.dblclick',
    'mouse.down',
    'mouse.up',
    'mouse.move'
];
const mouseIdleRequireActions = [
    'click',
    'dblclick',
    'dragAndDrop',
    'fill',
    'hover',
    'tap',
    'press',
    'keyboard.type',
    'keyboard.press',
    'mouse.wheel',
    'mouse.click',
    'mouse.dblclick',
    'mouse.down',
    'mouse.up',
    'mouse.move'
];
class RemotePlaywright {
    static getRemotePage(show_debug_cursor, logger) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentPage) {
                return this.currentPage;
            }
            /**
             * OCS桌面端后端无法拦截 GM_xmlhttpRequest ，所以这里使用 fetch 请求动作执行，然后后端根据key判断是否允许执行
             */
            if (!this.authToken) {
                try {
                    this.authToken = yield (0, utils_1.request)('http://localhost:15319/get-actions-key', {
                        type: 'GM_xmlhttpRequest',
                        method: 'get',
                        responseType: 'text'
                    });
                    const environment = yield (0, utils_1.request)(`http://localhost:15319/ocs-environment?page=${encodeURIComponent(window.location.href)}`, { type: 'GM_xmlhttpRequest', method: 'get', responseType: 'json' });
                    this.remoteActions = (environment === null || environment === void 0 ? void 0 : environment.remoteActions) === 'webview' ? 'webview' : 'playwright';
                    this.currentPage = this.createRemotePage(this.authToken, {
                        show_debug_cursor,
                        logger,
                        remoteActions: this.remoteActions
                    });
                    return this.currentPage;
                }
                catch (e) {
                    console.log(e);
                    return undefined;
                }
            }
            else {
                this.currentPage = this.createRemotePage(this.authToken, {
                    show_debug_cursor,
                    logger,
                    remoteActions: this.remoteActions
                });
                return this.currentPage;
            }
        });
    }
    static createRemotePage(authToken, configs) {
        const page = Object.create({});
        configs = configs || {};
        configs.logger = configs.logger || console.debug;
        for (const property of ListOfActions) {
            Reflect.set(page, property, (...args) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                let data;
                if (mouseIdleRequireActions.includes(property)) {
                    // 等待鼠标静止/空闲
                    yield waitForMouseIdle();
                }
                if (property === 'click') {
                    if (args[0] instanceof Element) {
                        const el = args[0];
                        const options = (args[1] || {});
                        yield scrollToElement(el);
                        // 如果是传入的元素对象，那么就解析元素的坐标进行点击
                        // 这里滑动的时间可能会比较长，取决于页面的长度，所以这里多等待一点时间
                        yield common_1.$.sleep(500);
                        const rect = el.getBoundingClientRect();
                        // 移动可能阻挡点击的脚本面板
                        const elFromPoint = (_a = easy_us_1.$elements.root) === null || _a === void 0 ? void 0 : _a.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                        if (elFromPoint && easy_us_1.$elements.root && easy_us_1.$elements.root.contains(elFromPoint)) {
                            // 如果元素在根节点内，则隐藏面板
                            const panel = easy_us_1.$elements.root.querySelector('container-element');
                            if (panel) {
                                easy_us_1.$message.info({ content: '检测到脚本阻挡点击位置，已自动移开', duration: 2 });
                                yield common_1.$.transition(panel, 'left', 0.1, rect.left + rect.width / 2 + 100 + 'px', { reset_ms: 1 });
                            }
                        }
                        // 显示鼠标位置
                        if (configs === null || configs === void 0 ? void 0 : configs.show_debug_cursor) {
                            showMousePointer(el);
                        }
                        data = {
                            page: window.location.href,
                            property: 'mouse.click',
                            args: [
                                rect.left + rect.width / 2,
                                rect.top + rect.height / 2,
                                {
                                    button: options.button,
                                    clickCount: options.clickCount,
                                    delay: options.delay
                                }
                            ]
                        };
                    }
                    else if (typeof args[0] === 'string') {
                        const el = document.querySelector(args[0]);
                        if (el) {
                            yield scrollToElement(el);
                            // 显示鼠标位置
                            if (configs === null || configs === void 0 ? void 0 : configs.show_debug_cursor) {
                                showMousePointer(el);
                            }
                        }
                    }
                }
                if (!data) {
                    data = { page: window.location.href, property: property, args: args };
                }
                (_b = configs === null || configs === void 0 ? void 0 : configs.logger) === null || _b === void 0 ? void 0 : _b.call(configs, '[RP]: ', JSON.stringify(data));
                try {
                    const actionData = Object.assign(Object.assign({}, data), { args: (configs === null || configs === void 0 ? void 0 : configs.remoteActions) === 'webview'
                            ? data.args.map((arg) => arg instanceof RegExp ? { __ocsRegex: arg.source, flags: arg.flags } : arg)
                            : data.args });
                    // 这里为什么不写前缀 http://localhost:15319，因为有 Content-Security-Policy ， 这里我们借用后台的URL代理去进行处理，只要包含 ocs-script-actions 即可轻松绕过 Content-Security-Policy 限制
                    const res = yield (0, utils_1.request)((configs === null || configs === void 0 ? void 0 : configs.remoteActions) === 'webview'
                        ? 'http://localhost:15319/ocs-script-actions'
                        : '/ocs-script-actions', {
                        type: (configs === null || configs === void 0 ? void 0 : configs.remoteActions) === 'webview' ? 'GM_xmlhttpRequest' : 'fetch',
                        method: 'post',
                        responseType: ['waitForRequest', 'waitForResponse', 'reload'].includes(property) ? 'json' : 'text',
                        headers: {
                            'auth-token': authToken
                        },
                        data: actionData
                    });
                    return res;
                }
                catch (e) {
                    (_c = configs === null || configs === void 0 ? void 0 : configs.logger) === null || _c === void 0 ? void 0 : _c.call(configs, '[RP-ERROR]: ', JSON.stringify(data));
                    return undefined;
                }
            }));
        }
        console.log(page);
        return page;
    }
}
exports.RemotePlaywright = RemotePlaywright;
RemotePlaywright.authToken = '';
RemotePlaywright.currentPage = undefined;
RemotePlaywright.remoteActions = 'playwright';
function scrollToElement(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 等待动作完成
    return common_1.$.sleep(200);
}
function showMousePointer(el) {
    setTimeout(() => {
        const rect = el.getBoundingClientRect();
        // 显示鼠标位置
        const div = document.createElement('div');
        div.textContent = '';
        div.style.position = 'fixed';
        div.style.zIndex = '99999';
        div.style.width = '20px';
        div.style.height = '20px';
        div.style.border = '2px solid red';
        div.style.borderRadius = '50%';
        div.style.left = rect.left + rect.width / 2 - 11 + 'px';
        div.style.top = rect.top + rect.height / 2 - 11 + 'px';
        document.body.append(div);
        setTimeout(() => {
            div.remove();
        }, 500);
    }, 100);
}
function waitForMouseIdle(timeout = 200) {
    return new Promise((resolve) => {
        let timer;
        const default_timer = setTimeout(() => {
            window.removeEventListener('mousemove', onMouseMove);
            resolve();
        }, timeout); // 最多等timeout + 1000ms
        function onMouseMove() {
            clearTimeout(default_timer);
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                window.removeEventListener('mousemove', onMouseMove);
                resolve();
            }, timeout);
        }
        window.addEventListener('mousemove', onMouseMove);
    });
}
