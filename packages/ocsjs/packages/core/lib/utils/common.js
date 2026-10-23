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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.$ = void 0;
const debounce_1 = __importDefault(require("lodash/debounce"));
/**
 * 公共的工具库
 */
exports.$ = {
    /** 创建唯一id ， 不带横杠 */
    uuid() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    },
    /**
     * 生成随机数， 使用 Math.round 取整
     * @param min 最小值
     * @param max 最大值
     */
    random(min, max) {
        return Math.round(Math.random() * (max - min)) + min;
    },
    /**
     * 暂停
     * @param period 毫秒
     */
    sleep(period) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                setTimeout(resolve, period);
            });
        });
    },
    /**
     * 当前是否处于浏览器环境
     */
    isInBrowser() {
        return typeof window !== 'undefined' && typeof window.document !== 'undefined';
    },
    /**
     * 使元素变成纯文本对象，（跨域时对象上下文会被销毁）
     * @param el 元素
     */
    elementToRawObject(el) {
        return {
            innerText: el === null || el === void 0 ? void 0 : el.innerText,
            innerHTML: el === null || el === void 0 ? void 0 : el.innerHTML,
            textContent: el === null || el === void 0 ? void 0 : el.textContent
        };
    },
    /**
     * 监听页面宽度变化
     * @param el 任意元素，如果此元素被移除，则不执行 resize 回调
     * @param handler resize 回调
     */
    onresize(el, handler) {
        const resize = (0, debounce_1.default)(() => {
            /**
             * 如果元素被删除，则移除监听器
             * 不使用 el.parentElement 是因为如果是顶级元素，例如 shadowRoot 中的一级子元素， el.parentNode 不为空，但是 el.parentElement 为空
             */
            if (el.parentNode === null) {
                window.removeEventListener('resize', resize);
            }
            else {
                handler(el);
            }
        }, 200);
        resize();
        window.addEventListener('resize', resize);
    },
    /** 是否处于顶级 window ，而不是子 iframe */
    isInTopWindow() {
        return self === top;
    },
    /**
     * 创建弹出窗口
     * @param url 地址
     * @param winName 窗口名
     * @param w 宽
     * @param h 高
     * @param scroll 滚动条
     */
    createCenteredPopupWindow(url, winName, opts) {
        const { width, height, scrollbars, resizable } = opts;
        const LeftPosition = screen.width ? (screen.width - width) / 2 : 0;
        const TopPosition = screen.height ? (screen.height - height) / 2 : 0;
        const settings = 'height=' +
            height +
            ',width=' +
            width +
            ',top=' +
            TopPosition +
            ',left=' +
            LeftPosition +
            ',scrollbars=' +
            (scrollbars ? 'yes' : 'no') +
            ',resizable=' +
            (resizable ? 'yes' : 'no');
        return window.open(url, winName, settings);
    },
    transition: (el, properties, duration_ms, val, options) => __awaiter(void 0, void 0, void 0, function* () {
        return new Promise((resolve) => {
            const original_val = Reflect.get(el.style, properties) || '';
            el.style.transition = `${String(properties)} ${duration_ms}s ${(options === null || options === void 0 ? void 0 : options.timing_function) || 'ease-in-out'}`;
            Reflect.set(el.style, properties, val);
            el.addEventListener('transitionend', function handler() {
                el.removeEventListener('transitionend', handler);
                setTimeout(() => {
                    Reflect.set(el.style, properties, original_val);
                    setTimeout(() => {
                        el.style.transition = '';
                    }, duration_ms * 1000);
                }, ((options === null || options === void 0 ? void 0 : options.reset_ms) || 0) * 1000);
                resolve();
            });
        });
    })
};
