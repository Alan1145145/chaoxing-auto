"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropdownStyle = exports.workNotes = exports.auto = exports.definition = exports.restudy = exports.volume = exports.playbackRate = void 0;
const easy_us_1 = require("easy-us");
const _1 = require(".");
/**
 * 可复用的配置参数
 */
/**
 * 倍速设置
 */
exports.playbackRate = {
    label: '视频倍速',
    tag: 'select',
    options: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 6, 8, 16].map((rate) => [rate.toString(), rate + ' x']),
    defaultValue: '1'
};
/** 音量调节配置  */
exports.volume = {
    label: '音量调节',
    attrs: { type: 'range', step: '0.05', min: '0', max: '1' },
    defaultValue: 0,
    onload() {
        (0, _1.createRangeTooltip)(this, '0', (val) => `${parseFloat(val) * 100}%`);
    }
};
/** 复习模式配置 */
exports.restudy = {
    label: '复习模式',
    attrs: { title: '已经完成的视频继续学习', type: 'checkbox' },
    defaultValue: false
};
/** 清晰度配置 */
exports.definition = {
    label: '清晰度',
    tag: 'select',
    defaultValue: 'line1bq',
    options: [
        ['line1bq', '流畅'],
        ['line1gq', '高清']
    ]
};
/** 开启自动答题 */
exports.auto = {
    label: '开启自动答题',
    attrs: { type: 'checkbox' },
    defaultValue: false
};
/** 答题提示 */
exports.workNotes = {
    defaultValue: easy_us_1.$ui.notes([
        '自动答题前请在 “通用-全局设置” 中接入模型。',
        '可以搭配 “通用-在线搜题” 一起使用。',
        '⚠️禁止同时开多个作业/考试页面。'
    ]).outerHTML
};
exports.dropdownStyle = {
    labelClassName: 'checkbox-label',
    providerClassName: 'checkbox-input',
    enableForAttribute: true,
    onload(el) {
        // @ts-ignore
        const checked = this.checked;
        el.classList.toggle('checked', checked);
        this.addEventListener('change', () => {
            // @ts-ignore
            el.classList.toggle('checked', this.checked);
        });
    }
};
