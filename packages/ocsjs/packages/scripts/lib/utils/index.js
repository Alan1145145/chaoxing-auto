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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.$msg = exports.createQuestionTitleExtra = exports.enableCopy = exports.playMedia = exports.createRangeTooltip = exports.workPreCheckMessage = void 0;
const core_1 = require("@ocsjs/core");
const easy_us_1 = require("easy-us");
const background_1 = require("../projects/background");
const work_1 = require("./work");
/** 创建答题预处理信息 */
function workPreCheckMessage(options) {
    var _a;
    const { onrun, onNoAnswererWrappers, onclose } = options, opts = __rest(options, ["onrun", "onNoAnswererWrappers", "onclose"]);
    if (opts.answererWrappers.length === 0) {
        onNoAnswererWrappers === null || onNoAnswererWrappers === void 0 ? void 0 : onNoAnswererWrappers(opts);
        return (0, work_1.answerWrapperEmptyWarning)(0);
    }
    else {
        options.start_delay_seconds = (_a = options.start_delay_seconds) !== null && _a !== void 0 ? _a : 5;
        return easy_us_1.$message.info({
            duration: options.start_delay_seconds,
            content: (0, easy_us_1.h)('span', [
                `${options.start_delay_seconds}秒后自动答题，`,
                easy_us_1.$ui.preventText({
                    name: '点击取消',
                    delay: options.start_delay_seconds,
                    ondefault: (span) => {
                        onrun(opts);
                    },
                    onprevent(span) {
                        const closedMessage = easy_us_1.$message.warn({
                            content: '已关闭此次的自动答题，请手动开启或者忽略此警告。',
                            duration: 0
                        });
                        if (closedMessage) {
                            onclose === null || onclose === void 0 ? void 0 : onclose(opts, closedMessage);
                        }
                    }
                })
            ])
        });
    }
}
exports.workPreCheckMessage = workPreCheckMessage;
/**
 * 创造范围选择器的提示
 */
function createRangeTooltip(input, defaultValue, transform) {
    input.addEventListener('change', () => {
        input.setAttribute('data-title', transform(input.value || input.getAttribute('value') || defaultValue));
    });
    input.setAttribute('data-title', transform(input.value || input.getAttribute('value') || defaultValue));
}
exports.createRangeTooltip = createRangeTooltip;
// 有些网课会改变 media.play 方法，所以可能不是一个 promise
function playMedia(playFunction) {
    return __awaiter(this, void 0, void 0, function* () {
        //  尝试播放
        const tryPlayMedia = () => {
            return new Promise((resolve, reject) => {
                try {
                    const playRes = playFunction();
                    if (playRes) {
                        playRes.then(resolve).catch(reject);
                    }
                    else {
                        resolve();
                    }
                }
                catch (err) {
                    reject(err);
                }
            });
        };
        try {
            yield tryPlayMedia();
            return true;
        }
        catch (err) {
            console.error(err);
            if (String(err).includes(`failed because the user didn't interact with the document first`)) {
                easy_us_1.$modal.alert({
                    content: '播放音视频失败，由于浏览器的用户隐私保护措施，如果要播放带有音量的视频，或者某些无法自动播放音视频的网站，您必须先点击一次页面上的任意位置脚本才能进行音视频的播放，后续无需重新点击。',
                    onClose: () => __awaiter(this, void 0, void 0, function* () {
                        yield tryPlayMedia();
                    })
                });
                return true;
            }
            else if (String(err).includes('The element has no supported sources')) {
                background_1.$console.error('当前视频无法播放。');
            }
            else {
                background_1.$console.error('播放视频时发生未知错误：' + String(err));
            }
            return false;
        }
    });
}
exports.playMedia = playMedia;
/**
 * 	解除复制限制功能
 * @param elements 要开启复制功能的元素
 */
function enableCopy(elements) {
    // 将页面上的所有选择方法劫持，并强制返回 true
    function hackSelect(target) {
        if (target) {
            const _original_select = target.onselectstart;
            const _original_oncopy = target.oncopy;
            const _original_onpaste = target.onpaste;
            const _original_onkeydown = target.onkeydown;
            target.onselectstart = (e) => {
                _original_select === null || _original_select === void 0 ? void 0 : _original_select.apply(target, [e]);
                e.stopPropagation();
                e.returnValue = true;
                return true;
            };
            target.oncopy = (e) => {
                _original_oncopy === null || _original_oncopy === void 0 ? void 0 : _original_oncopy.apply(target, [e]);
                e.stopPropagation();
                e.returnValue = true;
                return true;
            };
            target.onpaste = (e) => {
                _original_onpaste === null || _original_onpaste === void 0 ? void 0 : _original_onpaste.apply(target, [e]);
                e.stopPropagation();
                e.returnValue = true;
                return true;
            };
            target.onkeydown = (e) => {
                _original_onkeydown === null || _original_onkeydown === void 0 ? void 0 : _original_onkeydown.apply(target, [e]);
                e.stopPropagation();
                e.returnValue = true;
                return true;
            };
        }
    }
    for (const el of elements) {
        hackSelect(el);
    }
}
exports.enableCopy = enableCopy;
let popupWin;
window.addEventListener('beforeunload', () => {
    popupWin === null || popupWin === void 0 ? void 0 : popupWin.close();
});
/**
 * 创建关于问题题目的拓展功能按钮，包括复制和百度一下
 * @param question 问题
 */
/**
 * 题目区域的额外操作行（右对齐，按钮统一为项目通用按钮样式）。
 * @param question 题目文本（复制/搜索用）
 * @param left 需要放在"复制"按钮左侧的元素（如题型标签），避免独占一行高度
 */
function createQuestionTitleExtra(question, ...left) {
    /**
     * 通用次要按钮样式 + 原有紧凑尺寸。
     * 注意必须用 flex 居中而非 line-height：appearance:none 后 input 文本垂直位置由字体
     * metrics 决定（line-height:normal 随字体变化），不同页面字体下文本会上下偏移；
     * line-height:1 + flex 居中与字体无关，且避免 emoji 行盒撑高按钮。
     */
    const btnAttrs = {
        className: 'base-style-button-secondary',
        style: {
            padding: '0 4px',
            fontSize: '12px',
            height: '20px',
            lineHeight: '1',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
        }
    };
    /** 复制题目按钮（点击后短暂显示反馈） */
    const copyBtn = easy_us_1.$ui.button('复制', btnAttrs);
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(question);
        copyBtn.value = '已复制√';
        setTimeout(() => {
            copyBtn.value = '复制';
        }, 500);
    };
    /** 百度搜题按钮 */
    const baiduBtn = easy_us_1.$ui.button('🌏百度一下', btnAttrs);
    baiduBtn.onclick = () => {
        popupWin === null || popupWin === void 0 ? void 0 : popupWin.close();
        popupWin = core_1.$.createCenteredPopupWindow(`https://www.baidu.com/s?wd=${question}`, '百度搜索', {
            width: 1000,
            height: 800,
            resizable: true,
            scrollbars: true
        });
    };
    const space = easy_us_1.$ui.space([...left, copyBtn, baiduBtn], { x: 4 });
    space.style.marginTop = '6px';
    space.style.textAlign = 'right';
    return (0, easy_us_1.h)('div', { style: { textAlign: 'right' } }, [space]);
}
exports.createQuestionTitleExtra = createQuestionTitleExtra;
function msg(type, attrs) {
    easy_us_1.$message[type](attrs);
    if (type === 'success') {
        type = 'info';
    }
    let content = '';
    if (typeof attrs === 'string') {
        content = attrs;
    }
    else {
        if (attrs.content instanceof HTMLElement) {
            content = attrs.content.innerText;
        }
        else if (typeof attrs.content === 'string') {
            content = attrs.content.toString();
        }
    }
    background_1.$console[type](content);
}
exports.$msg = {
    /**  输出气泡消息以及日志记录  */
    info: (attrs) => msg('info', attrs),
    /**  输出气泡消息以及日志记录  */
    warn: (attrs) => msg('warn', attrs),
    /**  输出气泡消息以及日志记录  */
    error: (attrs) => msg('error', attrs),
    /**  输出气泡消息以及日志记录  */
    success: (attrs) => msg('success', attrs)
};
