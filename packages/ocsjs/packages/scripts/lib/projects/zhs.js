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
exports.ZHSProject = void 0;
const easy_us_1 = require("easy-us");
const core_1 = require("@ocsjs/core");
const common_1 = require("./common");
const configs_1 = require("../utils/configs");
const zhs_configs_1 = require("../utils/zhs.configs");
const config_migrate_1 = require("../utils/config-migrate");
const work_1 = require("../utils/work");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const background_1 = require("./background");
const study_1 = require("../utils/study");
const app_1 = require("../utils/app");
const render_1 = require("../utils/render");
const state = {
    study: {
        /**
         * 学习是否暂停
         */
        stop: false,
        currentMedia: undefined,
        stopInterval: 0,
        stopMessage: undefined
    }
};
/**
 * 需要软件辅助的掌握度页面
 */
const remote_not_required_pages = [
    'fusioncourseh5.zhihuishu.com',
    'studywisdomh5.zhihuishu.com',
    'wisdom-mooc.zhihuishu.com'
];
const gxk_read_notes = [
    '⚠️ 如果未开始答题，请尝试刷新页面。',
    '⚠️ 禁止同时打开多个作业/考试页面。',
    ['⚠️ 答题中请勿进行任何操作，如需暂停答题', '请等待全部题目搜索完成并执行自动保存功能后才能操作。'],
    ['⚠️ 暂停后手动操作请确保每个题目都点击下一题', '进行答案保存（不然不会保存，提交没分）']
];
class StudyVideoH5 {
    constructor() {
        this.remotePage = undefined;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.remotePage = yield background_1.BackgroundProject.scripts.dev.methods.getRemotePlaywrightCurrentPage();
            // 检查是否为软件环境
            if (!this.remotePage) {
                throw app_1.$playwright.showError();
            }
        });
    }
    getCourseName() {
        var _a;
        return ((_a = (0, easy_us_1.$el)('.source-name')) === null || _a === void 0 ? void 0 : _a.textContent) || '无名称';
    }
    getChapterName(root) {
        var _a;
        return ((_a = root.querySelector('.catalogue_title')) === null || _a === void 0 ? void 0 : _a.textContent) || '未知章节';
    }
    getNext(opts) {
        let videoItems = Array.from(document.querySelectorAll('.clearfix.video'));
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            videoItems = videoItems.filter((el) => el.querySelector('.time_icofinish') === null);
        }
        for (let i = 0; i < videoItems.length; i++) {
            const item = videoItems[i];
            if (item.classList.contains('current_play')) {
                return videoItems[i + (opts.next ? 1 : 0)];
            }
        }
        return videoItems[0];
    }
    switchPlaybackRate(rate) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const controlsBar = (0, easy_us_1.$el)('.controlsBar');
            const sl = (0, easy_us_1.$el)('.speedList');
            if (controlsBar && sl) {
                controlsBar.style.display = 'block';
                sl.style.display = 'block';
                /**
                 * 兼容 1.0 和 1 的两个属性值匹配
                 */
                const rate_parsed = parseFloat(String(rate));
                const selector = `.speedList [rate="${rate_parsed === 1 ? '1.0' : rate}"],.speedList [rate="${rate_parsed === 1 ? '1' : rate}"]`;
                if (this.remotePage) {
                    yield this.remotePage.click(selector);
                }
                else {
                    (_a = document.querySelector(selector)) === null || _a === void 0 ? void 0 : _a.click();
                }
            }
        });
    }
    switchLine(definition) {
        return __awaiter(this, void 0, void 0, function* () {
            const controlsBar = (0, easy_us_1.$el)('.controlsBar');
            const dl = (0, easy_us_1.$el)('.definiLines');
            if (controlsBar && dl) {
                controlsBar.style.display = 'block';
                dl.style.display = 'block';
                // :not(.active) ： 如果已经是激活状态则不点击
                const selector = `.definiLines .${definition}:not(.active)`;
                const el = document.querySelector(selector);
                if (el) {
                    if (this.remotePage) {
                        yield this.remotePage.click(selector);
                    }
                    else {
                        el.click();
                    }
                }
            }
        });
    }
    hasJob() {
        var _a;
        return ((_a = (0, easy_us_1.$$el)('.clearfix.video')) === null || _a === void 0 ? void 0 : _a.length) > 0;
    }
    hideDialog() {
        /** 隐藏通知弹窗 */
        (0, easy_us_1.$$el)('.el-dialog__wrapper').forEach((dialog) => {
            dialog.remove();
        });
    }
    handleTestDialog() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const items = (0, easy_us_1.$$el)('#playTopic-dialog .el-pager .number');
            if (items.length) {
                for (const item of items) {
                    if (item.classList.contains('active') === false) {
                        item.click();
                        yield easy_us_1.$.sleep(500);
                    }
                    const options = (0, easy_us_1.$$el)('#playTopic-dialog ul .topic-item');
                    if (options.length !== 0) {
                        yield waitForCaptcha();
                        // 最小化脚本窗口
                        render_1.$render.moveToEdge();
                        // 随机选
                        const random = Math.floor(Math.random() * options.length);
                        yield easy_us_1.$.sleep(1000);
                        // nth-child 从1开始
                        const btn_selector = `#playTopic-dialog .topic .radio ul > li:nth-child(${random + 1})`;
                        if (this.remotePage) {
                            yield this.remotePage.click(btn_selector);
                        }
                        else {
                            (_a = (0, easy_us_1.$el)(btn_selector)) === null || _a === void 0 ? void 0 : _a.click();
                        }
                        yield easy_us_1.$.sleep(1000);
                    }
                }
                yield easy_us_1.$.sleep(1000);
                // 关闭弹窗
                const close_btn_selector = '#playTopic-dialog .close-btn,#playTopic-dialog .btn';
                if (this.remotePage) {
                    yield this.remotePage.click(close_btn_selector);
                }
                else {
                    (_b = (0, easy_us_1.$el)(close_btn_selector)) === null || _b === void 0 ? void 0 : _b.click();
                }
            }
            /**
             * 每过三秒递归检测是否有弹窗
             */
            yield easy_us_1.$.sleep(3000);
            yield this.handleTestDialog();
        });
    }
}
/**
 * AI 助教课程，为智慧课程分类中的新课程
 */
class FusionCourseH5 extends StudyVideoH5 {
    getCourseName() {
        // 无法读取课程名称
        return '智慧课程-AI';
    }
    getChapterName(root) {
        // AI 助教课有两种进度模式，一个是百分百，一个是必学项目进度条
        const is_resource_box_mode = !!document.querySelector('.resource-box');
        if (is_resource_box_mode) {
            // 小节名称
            const card_name = root.querySelector('.file-name');
            if (card_name) {
                return card_name.textContent || '未知章节';
            }
        }
        return super.getChapterName(root);
    }
    getNext(opts) {
        // AI 助教课有两种进度模式，一个是百分百，一个是必学项目进度条
        const is_resource_box_mode = !!document.querySelector('.resource-box');
        if (is_resource_box_mode) {
            // 检测小节
            const getNextCard = () => {
                const cards = Array.from(document.querySelectorAll('.resources-item'));
                let target_el;
                let start = false;
                for (let index = 0; index < cards.length; index++) {
                    const card = cards[index];
                    if (start) {
                        if (opts.restudy) {
                            target_el = card;
                            break;
                        }
                        else {
                            if (card.querySelector('.isFinish')) {
                                continue;
                            }
                            target_el = card;
                            break;
                        }
                    }
                    if (card.className.includes('active')) {
                        start = true;
                    }
                }
                return target_el;
            };
            const next_card = getNextCard();
            if (next_card) {
                return next_card;
            }
        }
        let videoItems = Array.from(document.querySelectorAll('.clearfix.video')).filter((el) => {
            if (is_resource_box_mode) {
                return !!el.querySelector('.resource-box');
            }
            return true;
        });
        console.log(videoItems);
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            if (is_resource_box_mode) {
                videoItems = videoItems.filter((el) => {
                    var _a;
                    const text = ((_a = el.querySelector('.resource-text')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
                    const [progress, total] = text
                        .replace('必学', '')
                        .trim()
                        .split('/')
                        .map((s) => parseInt(s));
                    return progress < total;
                });
            }
            else {
                videoItems = videoItems.filter((el) => {
                    const num_el = el.querySelector('.progress-num');
                    return num_el === null || num_el.textContent !== '100%';
                });
            }
        }
        for (let i = 0; i < videoItems.length; i++) {
            const item = videoItems[i];
            if (is_resource_box_mode) {
                if (item.classList.contains('activeNode')) {
                    return videoItems[i + (opts.next ? 1 : 0)];
                }
            }
            else {
                if (item.classList.contains('current_play')) {
                    return videoItems[i + (opts.next ? 1 : 0)];
                }
            }
        }
        return videoItems[0];
    }
}
/**
 * 新共享课页面，为智慧课程分类中的新课程
 */
class StudyPlusH5 extends StudyVideoH5 {
    getCourseName() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = (0, easy_us_1.$el)('.top-back-box > span:nth-child(2)')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.match(/课程名称：(.+)/)) === null || _c === void 0 ? void 0 : _c[1]) || '无名称';
    }
    getChapterName(item) {
        var _a;
        return ((_a = item.parentElement) === null || _a === void 0 ? void 0 : _a.textContent) || '未知章节';
    }
    hasJob() {
        var _a;
        return ((_a = (0, easy_us_1.$$el)('.child-main')) === null || _a === void 0 ? void 0 : _a.length) > 0;
    }
    getNext(opts) {
        let videoItems = Array.from(document.querySelectorAll('.child-main')).filter((el) => { var _a; return (_a = el.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.child-time'); });
        console.log(videoItems);
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            videoItems = videoItems.filter((el) => {
                var _a;
                if ((_a = el.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.finish-icon')) {
                    return false;
                }
                return true;
            });
        }
        for (let i = 0; i < videoItems.length; i++) {
            const item = videoItems[i];
            if (item.classList.contains('current')) {
                return videoItems[i + (opts.next ? 1 : 0)];
            }
        }
        return videoItems[0];
    }
    hideDialog() {
        /** 隐藏通知弹窗 */
        (0, easy_us_1.$$el)('.el-overlay,.el-dialog').forEach((dialog) => {
            dialog.style.display = 'none';
        });
    }
    handleTestDialog(remotePage) {
        return __awaiter(this, void 0, void 0, function* () {
            const question_box = (0, easy_us_1.$el)('.ai-test-question-wrapper');
            const done = (0, easy_us_1.$el)('.ai-test-question-wrapper .done');
            if (question_box) {
                easy_us_1.$message.info('正在关闭弹窗测验...');
                const close_btn = (0, easy_us_1.$el)('.close-box', question_box);
                if (done) {
                    if (close_btn) {
                        if (remotePage) {
                            yield remotePage.click(close_btn);
                        }
                        else {
                            close_btn.click();
                        }
                    }
                }
                else {
                    const options = (0, easy_us_1.$$el)('.options .option', question_box);
                    if (options.length !== 0) {
                        yield waitForCaptcha();
                        // 最小化脚本窗口
                        render_1.$render.moveToEdge();
                        // 随机选
                        const random = Math.floor(Math.random() * options.length);
                        yield easy_us_1.$.sleep(1000);
                        if (remotePage) {
                            yield remotePage.click(options[random]);
                        }
                        else {
                            options[random].click();
                        }
                        yield easy_us_1.$.sleep(1000);
                    }
                    yield easy_us_1.$.sleep(1000);
                    const submit_btn = (0, easy_us_1.$el)('.submit-btn .submits');
                    if (submit_btn) {
                        if (remotePage) {
                            yield remotePage.click(submit_btn);
                        }
                        else {
                            submit_btn.click();
                        }
                    }
                    yield easy_us_1.$.sleep(1000);
                    if (close_btn) {
                        if (remotePage) {
                            yield remotePage.click(close_btn);
                        }
                        else {
                            close_btn.click();
                        }
                    }
                }
            }
            /**
             * 每过三秒递归检测是否有弹窗
             */
            yield easy_us_1.$.sleep(3000);
            yield this.handleTestDialog(remotePage);
        });
    }
}
/**
 * 2025-9月份新智慧学习页面，为智慧课程分类中的新课程
 */
class WishdomH5 extends StudyVideoH5 {
    getCourseName() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = (0, easy_us_1.$el)('.course-name')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.match(/课程名称：(.+)/)) === null || _c === void 0 ? void 0 : _c[1]) || '无名称';
    }
    getChapterName(item) {
        return item.textContent || '未知章节';
    }
    hasJob() {
        var _a;
        return ((_a = (0, easy_us_1.$$el)('.chapter-content .chapter-content-second')) === null || _a === void 0 ? void 0 : _a.length) > 0;
    }
    getNext(opts) {
        let jobs = Array.from(document.querySelectorAll('.chapter-content .chapter-item'));
        jobs = jobs
            .map((el) => {
            const children = el.querySelectorAll('.chapter-content-second');
            if (children.length > 0) {
                return Array.from(children);
            }
            else {
                return [el];
            }
        })
            .flat();
        console.log(jobs);
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            jobs = jobs.filter((el) => {
                if (el.querySelector('.finish-icon')) {
                    return false;
                }
                return true;
            });
        }
        for (let i = 0; i < jobs.length; i++) {
            const item = jobs[i];
            if (item.classList.contains('current')) {
                return jobs[i + (opts.next ? 1 : 0)];
            }
        }
        return jobs[0];
    }
    hideDialog() {
        /** 隐藏通知弹窗 */
        (0, easy_us_1.$$el)('.el-overlay,.el-dialog').forEach((dialog) => {
            dialog.style.display = 'none';
        });
    }
    handleTestDialog(remotePage) {
        return __awaiter(this, void 0, void 0, function* () {
            const question_box = (0, easy_us_1.$el)('.ai-class-exercise-dialog');
            if (question_box) {
                const options = (0, easy_us_1.$$el)('.ques-list .item .option');
                easy_us_1.$message.info('正在关闭弹窗测验...');
                if (options.length !== 0) {
                    yield waitForCaptcha();
                    // 最小化脚本窗口
                    background_1.BackgroundProject.scripts.render.methods.minimize();
                    background_1.BackgroundProject.scripts.render.methods.setPosition(100, 200);
                    // 随机选
                    const random = Math.floor(Math.random() * options.length);
                    yield easy_us_1.$.sleep(1000);
                    if (remotePage) {
                        yield remotePage.click(options[random]);
                    }
                    else {
                        options[random].click();
                    }
                    yield easy_us_1.$.sleep(1000);
                }
                yield easy_us_1.$.sleep(1000);
                const submit_btn = (0, easy_us_1.$el)('.ai-class-exercise-dialog .el-dialog__footer .el-button.btn');
                if (submit_btn) {
                    if (remotePage) {
                        yield remotePage.hover('.ai-class-exercise-dialog .el-dialog__footer .el-button.btn');
                        yield remotePage.click('.ai-class-exercise-dialog .el-dialog__footer .el-button.btn');
                    }
                    else {
                        submit_btn.click();
                    }
                }
                const close_btn = (0, easy_us_1.$el)('.ai-class-exercise-dialog .header-icon');
                if (close_btn) {
                    if (remotePage) {
                        yield remotePage.hover('.ai-class-exercise-dialog .header-icon');
                        yield remotePage.click('.ai-class-exercise-dialog .header-icon');
                    }
                    else {
                        close_btn.click();
                    }
                }
                // 如果无法关闭弹窗，后续版本只能强制删除
                // await $.sleep(1000);
                // document.querySelector('.components-box.has-compoent')?.remove();
                // document.querySelector('.transparent-mask')?.remove();
                easy_us_1.$message.info('弹窗测验已关闭');
            }
            /**
             * 每过三秒递归检测是否有弹窗
             */
            yield easy_us_1.$.sleep(3000);
            yield this.handleTestDialog(remotePage);
        });
    }
}
/**
 * 2025-9月份教学空间-AI智慧学习页面，新系统
 */
class Hike extends StudyVideoH5 {
    getCourseName() {
        return '无名称';
    }
    getChapterName(item) {
        return item.textContent || '未知章节';
    }
    hasJob() {
        var _a;
        return ((_a = document.querySelectorAll('.source-icon')) === null || _a === void 0 ? void 0 : _a.length) > 0;
    }
    getNext(opts) {
        let jobs = Array.from(document.querySelectorAll('.source-icon')).map((el) => { var _a; return (_a = el.parentElement) === null || _a === void 0 ? void 0 : _a.parentElement; });
        console.log(jobs);
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            jobs = jobs.filter((el) => {
                if (el.querySelector('i.select')) {
                    return false;
                }
                return true;
            });
        }
        for (let i = 0; i < jobs.length; i++) {
            const item = jobs[i];
            if (item.querySelector('.active-file')) {
                return jobs[i + (opts.next ? 1 : 0)];
            }
        }
        return jobs[0];
    }
    hideDialog() {
        /** 隐藏通知弹窗 */
        (0, easy_us_1.$$el)('.el-overlay,.el-dialog').forEach((dialog) => {
            dialog.style.display = 'none';
        });
    }
}
class HikeV2 extends StudyVideoH5 {
    getCourseName() {
        var _a;
        return ((_a = document.querySelector('.header-title-wrap')) === null || _a === void 0 ? void 0 : _a.textContent) || '无名称';
    }
    getChapterName() {
        var _a;
        return ((_a = document.querySelector('.el-tree-node.is-current .file-name')) === null || _a === void 0 ? void 0 : _a.textContent) || '未知章节';
    }
    hasJob() {
        var _a;
        return ((_a = document.querySelectorAll('.el-tree-node')) === null || _a === void 0 ? void 0 : _a.length) > 0;
    }
    getNext(opts) {
        let jobs = Array.from(document.querySelectorAll('.el-tree-node')).filter((e) => { var _a; return ((_a = e.querySelector('.el-tree-node__children')) === null || _a === void 0 ? void 0 : _a.children.length) === 0; });
        console.log(jobs);
        // 如果不是复习模式，则排除掉已经完成的任务
        if (!opts.restudy) {
            jobs = jobs.filter((el) => {
                if (el.querySelector('label.success')) {
                    return false;
                }
                return true;
            });
        }
        for (let i = 0; i < jobs.length; i++) {
            const item = jobs[i];
            if (item.classList.contains('.is-current')) {
                return jobs[i + (opts.next ? 1 : 0)];
            }
        }
        return jobs[0];
    }
    hideDialog() {
        /** 隐藏通知弹窗 */
        (0, easy_us_1.$$el)('.el-overlay,.el-dialog').forEach((dialog) => {
            dialog.style.display = 'none';
        });
    }
}
/** 工程导出 */
exports.ZHSProject = easy_us_1.Project.create({
    name: '知到智慧树',
    domains: [
        'zhihuishu.com',
        // 2025下半学期新系统: AI智慧课程
        'hike-teaching-center.polymas.com'
    ],
    scripts: {
        guide: new easy_us_1.Script({
            name: '💡 使用提示',
            matches: [
                ['学习首页', 'https://onlineweb.zhihuishu.com/onlinestuh5'],
                ['首页', 'https://www.zhihuishu.com/']
            ],
            namespace: 'zhs.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['登录网课平台', '进入任意视频、作业/考试界面', '等待脚本自动运行']).outerHTML +
                        easy_us_1.$ui.notes(['兴趣课会自动下一个，所以不提供脚本。']).outerHTML
                }
            },
            oncomplete() {
                // 置顶
                background_1.BackgroundProject.scripts.render.methods.pin(this);
                // 检测学习/视频界面分辨率，过小则提示用户自动调整缩放
                ensureWideViewport();
            },
            onrender({ panel }) {
                // 仅在油猴环境中显示设置跳转按钮（桌面软件等环境的脚本设置在其他平台/界面中显示）
                if (easy_us_1.$gm.isInGMContext()) {
                    /** 跳转到指定设置中心面板 */
                    const gotoPanel = (scriptKey) => {
                        const target = exports.ZHSProject.scripts[scriptKey];
                        // projectName 仅在面板渲染过时才被框架赋值，首次跳转需要手动补齐，
                        // 否则 pin 会退化为按 namespace 匹配，可能选中到被隐藏的脚本面板
                        target.projectName = exports.ZHSProject.name;
                        background_1.BackgroundProject.scripts.render.methods.pin(target);
                    };
                    panel.body.replaceChildren((0, easy_us_1.h)('hr'), easy_us_1.$ui.button('👉 前往学习设置', {}, (btn) => {
                        btn.style.marginRight = '12px';
                        btn.onclick = () => gotoPanel('study-center');
                    }), easy_us_1.$ui.button('👉 前往作业设置', {}, (btn) => {
                        btn.onclick = () => gotoPanel('work-center');
                    }));
                }
            }
        }),
        /**
         * 智慧树学习设置中心。
         *
         * 作为所有学习脚本的唯一可见入口，集中展示统一的使用提示与学习配置。
         * 实际的学习逻辑仍由下方被 hideInPanel 的各个学习脚本处理。
         */
        'study-center': new easy_us_1.Script({
            name: '🖥️ 自动学习',
            matches: [
                ['共享课学习页面', 'studyvideoh5.zhihuishu.com'],
                ['新共享课学习页面', 'studyplush5.zhihuishu.com'],
                ['新版AI课页面', 'fusioncourseh5.zhihuishu.com/stuStudy'],
                ['2025-9月新智慧共享课学习页面', 'studywisdomh5.zhihuishu.com/study/index'],
                ['新形态课程学习页面', 'smartcoursestudent.zhihuishu.com/learnPage'],
                ['新形态课程新域名学习页面', 'ai-smart-course-student-pro.zhihuishu.com/learnPage'],
                ['新形态课程首页', 'smartcoursestudent.zhihuishu.com/singleCourse'],
                ['新形态课程新域名课程首页', 'ai-smart-course-student-pro.zhihuishu.com/singleCourse'],
                ['校内课学习页面', 'zhihuishu.com/aidedteaching/sourceLearning'],
                ['新智慧学习页面', 'wisdom-mooc.zhihuishu.com/study/index'],
                ['AI教学空间学习首页', 'hike-teaching-center.polymas.com/stu-hike/agent-course-hike/ai-course-center'],
                ['AI教学空间学习页面', 'tools-hike/studentStudyResource'],
                ['AI教学空间学习首页(v2)', /polymas.com\/stu-hike\/agent-course-full\/.*\/stu\/(course-home|study)/],
                ['AI教学空间学习页面(v2)', '/stu/study/resource-detail']
            ],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: zhs_configs_1.studyCenterConfigs,
            oncomplete() {
                // 迁移旧命名空间配置
                (0, config_migrate_1.migrateZhsStudyConfigs)();
                // 置顶设置中心，作为用户主要交互入口
                background_1.BackgroundProject.scripts.render.methods.pin(this);
            }
        }),
        /**
         * 智慧树作业考试中心。
         *
         * 作为所有作业/考试/掌握度脚本的唯一可见入口，集中展示统一的使用提示与作业考试配置。
         * 实际的答题逻辑仍由下方被 hideInPanel 的各个作业考试脚本处理。
         */
        'work-center': new easy_us_1.Script({
            name: '📝 作业考试',
            matches: [
                ['共享课作业页面', 'zhihuishu.com/stuExamWeb.html#/webExamList/dohomework'],
                ['共享课考试页面', 'zhihuishu.com/stuExamWeb.html#/webExamList/doexamination'],
                ['作业考试列表', 'zhihuishu.com/stuExamWeb.html#/webExamList\\?'],
                ['新形态课程作业页面', 'smartcourseexam.zhihuishu.com/ReviewExam'],
                ['新形态课程-掌握提升页面', 'studentexamcomh5.zhihuishu.com/studentReviewTestOrExam'],
                ['新形态课程-AI助教掌握度', 'fusioncourseh5.zhihuishu.com/exam'],
                ['新形态课程-新AI助教掌握度', 'studywisdomh5.zhihuishu.com/exam'],
                // ========== 新AI学伴掌握度 ==========
                ['新形态课程-新AI学伴掌握度', 'wisdom-mooc.zhihuishu.com/exam'],
                ['新形态课程-新AI学伴掌握度首页', 'wisdom-mooc.zhihuishu.com/study/analysis'],
                ['新形态课程-考试界面', 'examloop.zhihuishu.com/exam'],
                ['校内课作业页面', 'zhihuishu.com/atHomeworkExam/stu/homeworkQ/exerciseList'],
                ['校内课考试页面', 'zhihuishu.com/atHomeworkExam/stu/examQ/examexercise'],
                ['AI教学中心-作业任务页面', '/stu-hike/stuHomeworkDo'],
                ['AI教学中心-题目作业', '/stu/answer-homework'],
                ['AI教学中心-考试页面', '/stu-exam/answer-exam']
            ],
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: zhs_configs_1.workCenterConfigs,
            oncomplete() {
                // 迁移旧命名空间配置
                (0, config_migrate_1.migrateZhsWorkConfigs)();
                // 置顶设置中心
                background_1.BackgroundProject.scripts.render.methods.pin(this);
                if (location.href.includes('wisdom-mooc.zhihuishu.com/study/analysis')) {
                    return easy_us_1.$message.info({ content: '请手动进入掌握度进行自动答题。', duration: 10 });
                }
            }
        }),
        'gxk-study': new easy_us_1.Script({
            name: '🖥️ 共享课-学习脚本',
            hideInPanel: true,
            matches: [
                ['共享课学习页面', 'studyvideoh5.zhihuishu.com'],
                ['新共享课学习页面', 'studyplush5.zhihuishu.com'],
                ['新版AI课页面', 'fusioncourseh5.zhihuishu.com/stuStudy'],
                ['2025-9月新智慧共享课学习页面', 'studywisdomh5.zhihuishu.com/study/index']
            ],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                /** 学习记录 []  */
                studyRecord: {
                    defaultValue: [],
                    extra: {
                        appConfigSync: false
                    }
                },
                stopTime: zhs_configs_1.stopTime,
                restudy: configs_1.restudy,
                reloadWhenError: zhs_configs_1.reloadWhenError,
                volume: configs_1.volume,
                definition: configs_1.definition,
                playbackRate: zhs_configs_1.playbackRate
            },
            methods() {
                return {
                    /**
                     * 增加学习时间
                     * @param courseName 课程名
                     * @param val 增加的时间
                     */
                    increaseStudyTime: (courseName, val) => {
                        const records = this.cfg.studyRecord;
                        // 查找是否存在今天的记录
                        const record = records.find((r) => new Date(r.date).toLocaleDateString() === new Date().toLocaleDateString());
                        let courses = [];
                        if (record) {
                            courses = record.courses;
                        }
                        else {
                            records.push({ date: Date.now(), courses: courses });
                        }
                        // 查找是否存在课程记录
                        const course = courses.find((c) => c.name === courseName);
                        if (course) {
                            // 存在则累加时间
                            course.time = course.time + val;
                            // 历史遗留问题，之前的倍速没有转换为数字，导致可能显示为字符串
                            if (typeof course.time === 'string') {
                                course.time = parseFloat(course.time);
                            }
                        }
                        else {
                            // 不存在则新建
                            courses.push({ name: courseName, time: 0 });
                        }
                        this.cfg.studyRecord = records;
                    }
                };
            },
            onrender({ panel }) {
                panel.body.replaceChildren((0, easy_us_1.h)('hr'), easy_us_1.$ui.button('⏰检测是否需要规律学习', {}, (btn) => {
                    btn.style.marginRight = '12px';
                    btn.onclick = () => {
                        var _a;
                        const href = ((_a = document.querySelector('[href*=stuLearnReportNew]')) === null || _a === void 0 ? void 0 : _a.getAttribute('href')) || '';
                        if (href) {
                            easy_us_1.$modal.alert({
                                title: '规律学习检测',
                                content: `自动检测功能已失效，<a href="${href}"> -> 点击此处 <- </a> 前往成绩分析页面，点击 <b>"学习习惯"</b> 即可查看习惯分详情。`
                            });
                        }
                        else {
                            easy_us_1.$modal.alert({
                                title: '提示',
                                content: '自动检测功能已失效，请自行前往成绩分析页面，点击学习习惯即可查看习惯分详情。'
                            });
                        }
                    };
                }), easy_us_1.$ui.button('📘查看学习记录', {}, (btn) => {
                    btn.onclick = () => {
                        easy_us_1.$modal.alert({
                            title: '学习记录',
                            content: easy_us_1.$ui.notes(this.cfg.studyRecord.map((r) => {
                                const date = new Date(r.date);
                                return [
                                    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
                                        .getDate()
                                        .toString()
                                        .padStart(2, '0')}`,
                                    easy_us_1.$ui.notes(r.courses.map((course) => `${course.name} - ${optimizeSecond(course.time)}`))
                                ];
                            }))
                        });
                    };
                }));
            },
            onactive() {
                // 重置时间
                this.cfg.stopTime = '0';
                if (this.cfg.playbackRate) {
                    // 转换为数字
                    this.cfg.playbackRate = parseFloat(this.cfg.playbackRate.toString());
                }
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsStudyConfigs)();
                    const type = location.href.includes('fusioncourseh5')
                        ? 'AI课程'
                        : location.href.includes('studyplush5')
                            ? '新共享课'
                            : location.href.includes('studywisdomh5')
                                ? '新智慧共享课'
                                : '共享课';
                    const ProcessorConstructor = location.href.includes('fusioncourseh5')
                        ? FusionCourseH5
                        : location.href.includes('studyplush5') || location.href.includes('studywisdomh5')
                            ? StudyPlusH5
                            : StudyVideoH5;
                    const processor = new ProcessorConstructor();
                    // 10秒后还没加载出来，则结束
                    setTimeout(() => {
                        if (processor.hasJob() === false) {
                            finishAlert();
                        }
                    }, 10 * 1000);
                    const waitForVideoJob = () => {
                        return new Promise((resolve, reject) => {
                            if (processor.hasJob()) {
                                resolve();
                            }
                            else {
                                setTimeout(() => {
                                    resolve(waitForVideoJob());
                                }, 200);
                            }
                        });
                    };
                    yield waitForVideoJob();
                    // 初始化处理器
                    yield processor.init();
                    // 监听定时停止
                    this.onConfigChange('stopTime', (stopTime) => {
                        if (stopTime === '0') {
                            easy_us_1.$message.info({ content: '定时停止已关闭' });
                        }
                        else {
                            autoStop(stopTime);
                        }
                    });
                    // 监听音量
                    this.onConfigChange('volume', (curr) => {
                        state.study.currentMedia && (state.study.currentMedia.volume = curr);
                    });
                    // 监听速度
                    this.onConfigChange('playbackRate', (curr) => {
                        if (typeof curr === 'string') {
                            this.cfg.playbackRate = parseFloat(curr);
                        }
                        processor.switchPlaybackRate(curr);
                    });
                    // 监听清晰度
                    this.onConfigChange('definition', (curr) => {
                        processor.switchLine(curr);
                    });
                    // 循环记录学习时间
                    const recordStudyTimeLoop = () => {
                        this.methods.increaseStudyTime(processor.getCourseName(), this.cfg.playbackRate);
                        setTimeout(recordStudyTimeLoop, 1000);
                    };
                    // 检测是否需要学前必读
                    closeDialogRead();
                    // 循环记录学习时间
                    recordStudyTimeLoop();
                    // 自动暂停任务
                    autoStop(this.cfg.stopTime);
                    // 自动隐藏弹窗
                    processor.hideDialog();
                    // 自动过弹窗测验
                    processor.handleTestDialog(processor.remotePage);
                    setInterval(() => __awaiter(this, void 0, void 0, function* () {
                        // 删除遮罩层
                        (0, easy_us_1.$$el)('.v-modal,.mask').forEach((modal) => {
                            modal.remove();
                        });
                        // 定时显示进度条，防止消失
                        fixProcessBar();
                    }), 3000);
                    easy_us_1.$message.info({ content: '3秒后开始学习', duration: 3 });
                    const remotePage = processor.remotePage;
                    const study = (opts) => __awaiter(this, void 0, void 0, function* () {
                        if (state.study.stop === false) {
                            const item = processor.getNext({ next: opts.next, restudy: this.cfg.restudy });
                            if (item) {
                                const msg = '即将学习：' + processor.getChapterName(item);
                                easy_us_1.$message.info({ content: msg });
                                background_1.$console.log(msg);
                                yield easy_us_1.$.sleep(3000);
                                // 最小化脚本窗口
                                render_1.$render.moveToEdge();
                                // 点击侧边栏任务
                                if (remotePage) {
                                    if (type === '新共享课') {
                                        yield remotePage.click('.title-box');
                                        yield easy_us_1.$.sleep(200);
                                    }
                                    yield remotePage.click(item);
                                    yield easy_us_1.$.sleep(1000);
                                    // 两次点击修复黑屏问题
                                    yield remotePage.click(item);
                                    yield easy_us_1.$.sleep(1000);
                                }
                                else {
                                    item.click();
                                }
                                // 适配AI助教课程PPT跳过
                                if (type === 'AI课程' && document.querySelector('.preview-warp .doc-box,.preview-warp .ppt-box')) {
                                    easy_us_1.$message.info({ content: '检测到PPT资源，即将跳过...' });
                                    yield easy_us_1.$.sleep(2000);
                                    study({ next: true });
                                    return;
                                }
                                watch(processor, {
                                    reloadWhenError: this.cfg.reloadWhenError,
                                    volume: this.cfg.volume,
                                    playbackRate: this.cfg.playbackRate,
                                    definition: this.cfg.definition
                                }, {
                                    reload() {
                                        // 旧共享课页面点击右侧栏就能重新加载
                                        if (type === '共享课') {
                                            study({ next: false });
                                        }
                                        else {
                                            location.reload();
                                        }
                                    },
                                    onended({ next }) {
                                        study({ next });
                                    }
                                });
                            }
                            else {
                                finishAlert();
                            }
                        }
                        else {
                            const msg = '检测到当前视频全部播放完毕，如果还有未完成的视频请刷新重试，或者打开复习模式。';
                            easy_us_1.$message.warn({ content: msg });
                            common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, {
                                duration: 0,
                                extraTitle: '知道智慧树学习脚本'
                            });
                        }
                    });
                    // 当页面初始化时无需切换下一个视频，直接播放当前的。
                    study({ next: false });
                });
            }
        }),
        'gxk-work': new easy_us_1.Script({
            name: '✍️ 共享课-作业考试脚本',
            hideInPanel: true,
            matches: [
                ['共享课作业页面', 'zhihuishu.com/stuExamWeb.html#/webExamList/dohomework'],
                ['共享课考试页面', 'zhihuishu.com/stuExamWeb.html#/webExamList/doexamination'],
                ['作业考试列表', 'zhihuishu.com/stuExamWeb.html#/webExamList\\?']
            ],
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {
                workDelay: {
                    label: '作业答题开始时间延迟（秒）',
                    defaultValue: 3,
                    attrs: { type: 'number', min: 1, step: 1, max: 10 }
                },
                readNotes: {
                    defaultValue: false
                }
            },
            methods() {
                function getWorkInfo(remotePage) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const isExam = location.href.includes('doexamination');
                        let url = '';
                        if (isExam) {
                            url = '/taurusExam/gateway/t/v1/student/doExam';
                        }
                        else {
                            url = '/studentExam/gateway/t/v1/student/doHomework';
                        }
                        return JSON.parse((yield remotePage.waitForResponse(url)).body);
                    });
                }
                return {
                    getWorkInfo: getWorkInfo,
                    work: () => __awaiter(this, void 0, void 0, function* () {
                        // 检查是否为软件环境
                        const remotePage = yield background_1.BackgroundProject.scripts.dev.methods.getRemotePlaywrightCurrentPage();
                        // 检查是否为软件环境
                        if (!remotePage) {
                            return app_1.$playwright.showError();
                        }
                        // 等待试卷加载
                        const isExam = location.href.includes('doexamination');
                        const isWork = location.href.includes('dohomework');
                        if (isExam || isWork) {
                            const workInfo = yield getWorkInfo(remotePage);
                            // 移动到边缘
                            render_1.$render.moveToEdge();
                            background_1.BackgroundProject.scripts.render.methods.normal();
                            // 固定脚本
                            background_1.BackgroundProject.scripts.render.methods.pin(this);
                            // 阅读须知
                            if (this.cfg.readNotes === false) {
                                const notes = easy_us_1.$ui.notes(gxk_read_notes).outerHTML;
                                const start = yield new Promise((resolve, reject) => {
                                    easy_us_1.$modal.confirm({
                                        title: isExam ? '脚本考前须知' : '脚本作业须知',
                                        content: notes,
                                        confirmButtonText: '我已知晓，开始自动答题',
                                        cancelButtonText: '取消答题',
                                        maskCloseable: false,
                                        onConfirm: () => {
                                            this.cfg.readNotes = true;
                                            resolve(true);
                                        },
                                        onCancel() {
                                            resolve(false);
                                        }
                                    });
                                });
                                if (!start) {
                                    easy_us_1.$message.info({ content: '已取消答题，如需答题请刷新页面重新开始。' });
                                    return;
                                }
                            }
                            setTimeout(() => {
                                var _a;
                                easy_us_1.$message.info({ content: `开始${isExam ? '考试' : '作业'}` });
                                (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                                    workerProvider: (opts) => gxkWorkAndExam(workInfo, opts),
                                    start_delay_seconds: (_a = this.cfg.workDelay) !== null && _a !== void 0 ? _a : 3
                                });
                            }, 1000);
                        }
                        else {
                            easy_us_1.$message.info({ content: '📢 请手动进入作业/考试，如果未开始答题，请尝试刷新页面。', duration: 0 });
                            background_1.BackgroundProject.scripts.render.methods.pin(this);
                        }
                    })
                };
            },
            onactive() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.methods.work();
                    /**
                     * 当页面从作业考试列表跳转到作业考试页面时，触发的是onhistorychange事件，而不是oncomplete事件。
                     */
                    this.on('historychange', () => {
                        this.methods.work();
                    });
                });
            }
        }),
        'smart-study': new easy_us_1.Script({
            name: '🖥️ 新形态课程-学习脚本',
            hideInPanel: true,
            matches: [
                ['新形态课程学习页面', 'smartcoursestudent.zhihuishu.com/learnPage'],
                ['新形态课程新域名学习页面', 'ai-smart-course-student-pro.zhihuishu.com/learnPage'],
                ['新形态课程首页', 'smartcoursestudent.zhihuishu.com/singleCourse'],
                ['新形态课程新域名课程首页', 'ai-smart-course-student-pro.zhihuishu.com/singleCourse']
            ],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                switchMode: zhs_configs_1.switchMode,
                restudy: configs_1.restudy,
                volume: configs_1.volume,
                definition: configs_1.definition,
                playbackRate: zhs_configs_1.playbackRate
            },
            oncomplete() {
                // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                (0, config_migrate_1.migrateZhsStudyConfigs)();
                this.methods.start();
            },
            onhistorychange(type, ...args) {
                if (type === 'push') {
                    this.methods.start();
                }
            },
            methods() {
                return {
                    start: () => __awaiter(this, void 0, void 0, function* () {
                        if (location.href.includes('singleCourse')) {
                            easy_us_1.$message.info({ content: '请点击任意章节开始进行自动学习', duration: 60 });
                            return;
                        }
                        const processor = new StudyVideoH5();
                        const getInfos = () => Array.from(document.querySelectorAll('.section-item-collapse-info'));
                        const getChapterName = () => {
                            var _a, _b;
                            return (((_a = document.querySelector('.point-title-text')) === null || _a === void 0 ? void 0 : _a.textContent) || '未知章节') +
                                '-' +
                                (((_b = document.querySelector('[class*="card-container"].active .video-title')) === null || _b === void 0 ? void 0 : _b.textContent) || '未知小节');
                        };
                        // 需点击的任务点，其他是是外部链接或者未知任务点
                        const include_jobs = ['video', 'book', /** 一般是PPT */ 'other', /** 一般是文档 */ 'text'];
                        const getNextJob = () => {
                            var _a, _b;
                            const cards = Array.from(document.querySelectorAll('[class*="card-container"]'));
                            // 如果没有正在选中的章节，证明第一个就是外链模式，此时默认点击第一个
                            if (cards.some((card) => card.classList.contains('active')) === false) {
                                return cards[0];
                            }
                            let target_el;
                            const start_index = cards.findIndex((c) => c.classList.contains('active')) || 0;
                            for (let index = start_index + 1; index < cards.length; index++) {
                                const card = cards[index];
                                if (this.cfg.restudy) {
                                    target_el = card;
                                    break;
                                }
                                else {
                                    if ((_b = (_a = card.querySelector('.finished-icon')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes('已完成')) {
                                        continue;
                                    }
                                    target_el = card;
                                    break;
                                }
                            }
                            return target_el;
                        };
                        const getNext = () => {
                            var _a, _b;
                            const infos = getInfos();
                            const works = [];
                            for (let index = 0; index < infos.length; index++) {
                                const info = infos[index];
                                const text = ((_a = info.querySelector('.collapse-info-progress .progress-text')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
                                if (this.cfg.switchMode === 'all') {
                                    works.push({
                                        info,
                                        progress: 0,
                                        total: 1
                                    });
                                }
                                else {
                                    const [progress, total] = text
                                        .replace('必学', '')
                                        .trim()
                                        .split('/')
                                        .map((s) => parseInt(s));
                                    if (progress < total) {
                                        works.push({ progress, total, info });
                                    }
                                }
                            }
                            let start = false;
                            for (let index = 0; index < works.length; index++) {
                                const work = works[index];
                                if (start) {
                                    if (work.progress < work.total) {
                                        return works[index].info;
                                    }
                                }
                                if (work.info.classList.contains('active')) {
                                    if (this.cfg.switchMode === 'all') {
                                        return works[index + 1].info;
                                    }
                                    else {
                                        start = true;
                                    }
                                }
                            }
                            return (_b = works[0]) === null || _b === void 0 ? void 0 : _b.info;
                        };
                        // 监听音量
                        this.onConfigChange('volume', (curr) => {
                            state.study.currentMedia && (state.study.currentMedia.volume = curr);
                        });
                        // 监听速度
                        this.onConfigChange('playbackRate', (curr) => {
                            if (typeof curr === 'string') {
                                this.cfg.playbackRate = parseFloat(curr);
                            }
                            processor.switchPlaybackRate(curr);
                        });
                        // 监听清晰度
                        this.onConfigChange('definition', (curr) => {
                            processor.switchLine(curr);
                        });
                        const doWork = () => __awaiter(this, void 0, void 0, function* () {
                            yield easy_us_1.$.sleep(5 * 1000);
                            const next = () => __awaiter(this, void 0, void 0, function* () {
                                const nextJob = getNextJob();
                                if (nextJob) {
                                    const nextJobTitle = nextJob.querySelector('.common-text');
                                    if (include_jobs.some((job) => { var _a; return (_a = nextJob.querySelector('.icon-box')) === null || _a === void 0 ? void 0 : _a.classList.contains(job); })) {
                                        nextJobTitle.click();
                                        yield doWork();
                                    }
                                    // 链接任务
                                    else {
                                        /**
                                         * 链接任务点不会自动取消 active 样式，导致无法获取下一个任务点
                                         * 这里手动移除 active 样式，避免影响获取下一个任务点
                                         */
                                        document
                                            .querySelectorAll('[class*="card-container"].active')
                                            .forEach((el) => el.classList.remove('active'));
                                        // 链接任务点不会自动附加 active 样式，这里手动添加
                                        nextJob === null || nextJob === void 0 ? void 0 : nextJob.classList.add('active');
                                        yield easy_us_1.$.sleep(1000);
                                        const _open = easy_us_1.$gm.unsafeWindow.open;
                                        easy_us_1.$gm.unsafeWindow.open = () => null;
                                        nextJobTitle.click();
                                        const msg = '链接任务完成，即将自动下一节！';
                                        easy_us_1.$message.info(msg);
                                        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                            easy_us_1.$gm.unsafeWindow.open = _open;
                                            // 直接下一个
                                            yield next();
                                        }), 3000);
                                    }
                                    return;
                                }
                                const nextEl = getNext();
                                if (nextEl) {
                                    nextEl.click();
                                }
                                else {
                                    finishAlert();
                                }
                            });
                            try {
                                const wrapper = document.querySelector('.video-player-wrapper');
                                if (!wrapper || wrapper.style.display === 'none') {
                                    throw new Error('视频加载失败');
                                }
                                yield (0, study_1.waitForMedia)({
                                    timeout: 5 * 1000,
                                    filter: (m) => m.src.length !== 0
                                });
                            }
                            catch (_a) {
                                const msg = '未找到学习视频，即将自动下一节！';
                                easy_us_1.$message.warn(msg);
                                background_1.$console.warn(msg);
                                yield easy_us_1.$.sleep(3000);
                                yield next();
                                return;
                            }
                            const set = () => __awaiter(this, void 0, void 0, function* () {
                                // 上面操作会导致元素刷新，这里重新获取视频
                                try {
                                    // 设置清晰度
                                    yield processor.switchLine(this.cfg.definition || 'line1bq');
                                    yield easy_us_1.$.sleep(1000);
                                    // 设置播放速度
                                    yield processor.switchPlaybackRate(this.cfg.playbackRate);
                                    yield easy_us_1.$.sleep(1000);
                                    const media = yield (0, study_1.waitForMedia)({ timeout: 5 * 1000, filter: (m) => m.src.length !== 0 });
                                    yield easy_us_1.$.sleep(1000);
                                    state.study.currentMedia = media;
                                    if (media) {
                                        // 如果已经播放完了，则重置视频进度
                                        media.currentTime = 1;
                                        // 音量
                                        media.volume = this.cfg.volume;
                                    }
                                    return state.study.currentMedia;
                                }
                                catch (e) {
                                    background_1.$console.log('视频加载失败，请尝试刷新页面！：' + e);
                                    easy_us_1.$message.error({ content: '视频加载失败，请尝试刷新页面！：' + e, duration: 0 });
                                }
                            });
                            const video = yield set();
                            if (!video) {
                                return;
                            }
                            (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play()).then(() => {
                                const cn = getChapterName();
                                easy_us_1.$message.info({ content: '正在学习：' + cn });
                                background_1.$console.log('正在学习：' + cn);
                            });
                            video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                                if (!(video === null || video === void 0 ? void 0 : video.ended) && state.study.stop === false) {
                                    yield easy_us_1.$.sleep(1000);
                                    video === null || video === void 0 ? void 0 : video.play();
                                }
                            });
                            video.onended = () => __awaiter(this, void 0, void 0, function* () {
                                easy_us_1.$message.info({ content: '即将自动跳转下一节' });
                                yield easy_us_1.$.sleep(3000);
                                yield next();
                            });
                        });
                        doWork();
                    })
                };
            }
        }),
        'smart-work': new easy_us_1.Script({
            name: '✍️ 新形态课程-作业/考试/掌握度脚本',
            hideInPanel: true,
            matches: [
                ['新形态课程作业页面', 'smartcourseexam.zhihuishu.com/ReviewExam'],
                ['新形态课程-掌握提升页面', 'studentexamcomh5.zhihuishu.com/studentReviewTestOrExam'],
                ['新形态课程-AI助教掌握度', 'fusioncourseh5.zhihuishu.com/exam'],
                ['新形态课程-新AI助教掌握度', 'studywisdomh5.zhihuishu.com/exam'],
                ['新形态课程-新AI学伴掌握度', 'wisdom-mooc.zhihuishu.com/exam']
            ],
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {
                workDelay: {
                    label: '作业答题开始时间延迟（秒）',
                    defaultValue: 3,
                    attrs: { type: 'number', min: 1, step: 1, max: 10 }
                }
            },
            methods() {
                return {
                    start: () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        // 检查是否为软件环境
                        let remotePage;
                        // 掌握度
                        const remote_not_required = remote_not_required_pages.some((domain) => location.href.includes(domain));
                        remote_not_required ? yield (0, study_1.waitForElement)('.exam-item') : yield (0, study_1.waitForElement)('.questionContent');
                        if (remote_not_required) {
                            // 这两个页面不需要软件辅助
                        }
                        else {
                            remotePage = yield background_1.BackgroundProject.scripts.dev.methods.getRemotePlaywrightCurrentPage();
                            // 检查是否为软件环境
                            if (!remotePage) {
                                return app_1.$playwright.showError();
                            }
                            // 移动到左上角
                            render_1.$render.moveToEdge();
                            easy_us_1.$message.warn({ content: '答题完毕之前请勿操作页面！', duration: 0 });
                        }
                        (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                            workerProvider: (opts) => {
                                if (remote_not_required) {
                                    return fusioncourseWork(remotePage, opts);
                                }
                                else {
                                    return smartWork(remotePage, opts);
                                }
                            },
                            start_delay_seconds: (_a = this.cfg.workDelay) !== null && _a !== void 0 ? _a : 3
                        });
                    })
                };
            },
            oncomplete() {
                this.methods.start();
            },
            onhistorychanged(type, ...args) {
                if (type === 'pushed') {
                    this.methods.start();
                }
            }
        }),
        'smart-exam': new easy_us_1.Script({
            name: '✍️ 新形态课程-考试脚本',
            hideInPanel: true,
            matches: [['新形态课程-考试界面', 'examloop.zhihuishu.com/exam']],
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {},
            methods() {
                return {
                    start: () => __awaiter(this, void 0, void 0, function* () {
                        // 检查是否为软件环境
                        background_1.BackgroundProject.scripts.render.methods.pin(this);
                        yield (0, study_1.waitForElement)('.question-area-content');
                        // 考完后的试卷预览
                        if (document.querySelector('[mode="REVIEW_MODE"]')) {
                            easy_us_1.$message.info('当前试卷状态已完成、脚本将停止运行。');
                            return;
                        }
                        (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                            workerProvider: (opts) => {
                                return smartExam(undefined, opts);
                            }
                        });
                    })
                };
            },
            oncomplete() {
                // 迁移旧命名空间下的用户配置到统一的 zhs.work 命名空间（幂等，可安全重复调用）
                (0, config_migrate_1.migrateZhsWorkConfigs)();
                this.methods.start();
            }
        }),
        'xnk-study': new easy_us_1.Script({
            name: '🖥️ 校内课（翻转课）-学习脚本',
            hideInPanel: true,
            matches: [['校内课学习页面', 'zhihuishu.com/aidedteaching/sourceLearning']],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                restudy: configs_1.restudy,
                volume: configs_1.volume
            },
            oncomplete() {
                // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                (0, config_migrate_1.migrateZhsStudyConfigs)();
                const finish = () => {
                    easy_us_1.$modal.alert({
                        content: '检测到当前视频全部播放完毕，如果还有未完成的视频请刷新重试，或者打开复习模式。'
                    });
                    common_1.CommonProject.scripts.settings.methods.notificationBySetting('检测到当前视频全部播放完毕，如果还有未完成的视频请刷新重试，或者打开复习模式。', { duration: 0, extraTitle: '知道智慧树学习脚本' });
                };
                // 监听音量
                this.onConfigChange('volume', (curr) => {
                    state.study.currentMedia && (state.study.currentMedia.volume = curr);
                });
                const nextElement = () => {
                    const list = document.querySelectorAll('.file-item');
                    let passActive = false;
                    for (let index = 0; index < list.length; index++) {
                        const item = list[index];
                        const finish = !!item.querySelector('.icon-finish');
                        // 判断是否需要学习
                        const needsStudy = !finish || (finish && this.cfg.restudy);
                        if (item.classList.contains('active')) {
                            if (needsStudy) {
                                return list[index + 1];
                            }
                            else {
                                passActive = true;
                            }
                        }
                        if (passActive && needsStudy) {
                            return item;
                        }
                    }
                };
                const interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    /** 查找任务 */
                    const next = nextElement();
                    if (next) {
                        clearInterval(interval);
                        if (document.querySelector('#mediaPlayer')) {
                            (_a = document.querySelector('.file-item.active')) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
                            const name = ((_b = next.querySelector('#sourceTit')) === null || _b === void 0 ? void 0 : _b.textContent) || '未知视频';
                            easy_us_1.$message.info('正在学习：' + name);
                            watchXnk({ volume: this.cfg.volume }, () => {
                                easy_us_1.$message.info('视频完成播放，正在自动跳转下一节！');
                                setTimeout(() => {
                                    /** 下一章 */
                                    const next = nextElement();
                                    if (next)
                                        next.click();
                                }, 3000);
                            });
                        }
                        else {
                            setTimeout(() => {
                                const msg = '未找到学习视频，即将自动下一节！';
                                easy_us_1.$message.warn(msg);
                                background_1.$console.warn(msg);
                                /** 下一章 */
                                const next = nextElement();
                                if (next)
                                    next.click();
                            }, 3000);
                        }
                    }
                }), 1000);
                setTimeout(() => {
                    if (!nextElement()) {
                        finish();
                        clearInterval(interval);
                    }
                }, 10 * 1000);
            }
        }),
        'xnk-work': new easy_us_1.Script({
            name: '✍️ 校内课-作业考试脚本',
            hideInPanel: true,
            matches: [
                ['校内课作业页面', 'zhihuishu.com/atHomeworkExam/stu/homeworkQ/exerciseList'],
                ['校内课考试页面', 'zhihuishu.com/atHomeworkExam/stu/examQ/examexercise']
            ],
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {},
            onhistorychanged(type) {
                var _a;
                if (type === 'pushed') {
                    (_a = this.oncomplete) === null || _a === void 0 ? void 0 : _a.call(this);
                }
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.work 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsWorkConfigs)();
                    (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                        workerProvider: xnkWork
                    });
                });
            }
        }),
        'wisdom-study': new easy_us_1.Script({
            name: '🖥️ 新智慧学习-学习脚本',
            hideInPanel: true,
            matches: [['2025-12月新智慧学习页面', 'wisdom-mooc.zhihuishu.com/study/index']],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                restudy: configs_1.restudy,
                skipStudyTimeWarnDialog: zhs_configs_1.skipStudyTimeWarnDialog,
                reloadWhenError: zhs_configs_1.reloadWhenError,
                volume: configs_1.volume,
                definition: configs_1.definition,
                playbackRate: zhs_configs_1.playbackRate
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsStudyConfigs)();
                    const processor = new WishdomH5();
                    // // 点击显示进度条，否则无法进行倍速，清晰度等操作
                    // const showControlBar = async () => {
                    // 	await processor.remotePage?.hover('.videoArea');
                    // 	await processor.remotePage?.click('.videoArea', { button: 'middle' });
                    // 	await processor.remotePage?.hover('.speedBox');
                    // 	// 需要点击一下屏幕中心，否则视频控制菜单无法正常弹出
                    // 	await processor.remotePage?.click('.speedBox', { button: 'middle' });
                    // };
                    // 监听音量
                    this.onConfigChange('volume', (curr) => {
                        state.study.currentMedia && (state.study.currentMedia.volume = curr);
                    });
                    // 监听速度
                    this.onConfigChange('playbackRate', (curr) => __awaiter(this, void 0, void 0, function* () {
                        if (typeof curr === 'string') {
                            this.cfg.playbackRate = parseFloat(curr);
                        }
                        fixProcessBar();
                        processor.switchPlaybackRate(curr);
                    }));
                    // 监听清晰度
                    this.onConfigChange('definition', (curr) => __awaiter(this, void 0, void 0, function* () {
                        fixProcessBar();
                        processor.switchLine(curr);
                    }));
                    const next = () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const hidden = (0, easy_us_1.$el)('.chapter-wrapper.hidden');
                        if (hidden) {
                            if (processor.remotePage) {
                                yield processor.remotePage.click('.collapse-box');
                            }
                            else {
                                yield hidden.click();
                            }
                        }
                        // 全部章节下拉展开
                        document.querySelectorAll('.el-collapse-item__wrap').forEach((e) => (e.style.display = ''));
                        yield easy_us_1.$.sleep(200);
                        const nextJob = processor.getNext({ next: true, restudy: this.cfg.restudy });
                        if (nextJob) {
                            if (!this.cfg.skipStudyTimeWarnDialog && hasStudyTimeWarnDialog()) {
                                easy_us_1.$message.warn({
                                    content: '检测到习惯分弹窗，当天学习时间已满，如需继续学习，请手动关闭后，刷新页面重新运行脚本！（如想强制学习请前往脚本设置忽略弹窗）',
                                    duration: 0
                                });
                                return;
                            }
                            else {
                                yield closeStudyTimeWarnDialog();
                            }
                            yield waitForMasteryLevelDialogClose();
                            // 展开章节
                            yield ((_a = processor.remotePage) === null || _a === void 0 ? void 0 : _a.click(nextJob));
                            nextJob.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            doWork();
                        }
                        else {
                            finishAlert();
                        }
                    });
                    // 实时检测关闭掌握度页面
                    const closeMasteryLevelDialog = () => {
                        return new Promise((resolve, reject) => {
                            const check = () => {
                                var _a;
                                if (document.querySelector('.masterylevel-body')) {
                                    (_a = processor.remotePage) === null || _a === void 0 ? void 0 : _a.click('.header-box .close-box');
                                    easy_us_1.$message.info('掌握度页面已关闭，即将继续学习！');
                                }
                                setTimeout(check, 3000);
                            };
                            check();
                        });
                    };
                    const hasStudyTimeWarnDialog = () => {
                        return !!Array.from(document.querySelectorAll('.el-overlay .content')).find((el) => { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('保持良好的学习习惯'); });
                    };
                    const closeStudyTimeWarnDialog = () => {
                        return new Promise((resolve, reject) => {
                            const interval = setInterval(() => {
                                var _a;
                                const dialog = Array.from(document.querySelectorAll('.el-overlay')).find((el) => { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('保持良好的学习习惯'); });
                                if (dialog) {
                                    const btn = dialog.querySelector('.el-dialog__header img');
                                    if (btn)
                                        (_a = processor.remotePage) === null || _a === void 0 ? void 0 : _a.click(btn);
                                    clearInterval(interval);
                                    resolve();
                                }
                            }, 1000);
                            // 3秒后自动结束
                            setTimeout(() => {
                                clearInterval(interval);
                                resolve();
                            }, 3 * 1000);
                        });
                    };
                    const waitForMasteryLevelDialogClose = () => __awaiter(this, void 0, void 0, function* () {
                        return new Promise((resolve, reject) => {
                            const check = () => {
                                if (!document.querySelector('.masterylevel-body')) {
                                    resolve();
                                }
                                else {
                                    setTimeout(check, 200);
                                }
                            };
                            check();
                        });
                    });
                    const waitForLoad = () => {
                        return new Promise((resolve, reject) => {
                            const check = () => {
                                if (document.querySelector('.video-play')) {
                                    resolve();
                                }
                                else {
                                    setTimeout(check, 3000);
                                }
                            };
                            check();
                        });
                    };
                    yield waitForLoad();
                    yield easy_us_1.$.sleep(3000);
                    closeMasteryLevelDialog();
                    // 自动隐藏弹窗
                    processor.hideDialog();
                    // 初始化处理器
                    yield processor.init();
                    // 自动过弹窗测验
                    processor.handleTestDialog(processor.remotePage);
                    setInterval(() => {
                        // 定时显示进度条，防止消失
                        fixProcessBar();
                    }, 1000);
                    easy_us_1.$message.success({ content: '即将开始自动学习！' });
                    const reload = (e) => __awaiter(this, void 0, void 0, function* () {
                        background_1.$console.error(e);
                        if (this.cfg.reloadWhenError) {
                            const msg = '视频加载失败，即将刷新页面。';
                            const reload_count = yield easy_us_1.$store.getTab('reload-count');
                            if (reload_count && reload_count > 3) {
                                const msg = '视频加载失败/黑屏导致重新加载页面次数超过3次，请尝试关闭页面重新打开，或者检查网络连接！';
                                yield easy_us_1.$store.setTab('reload-count', 0);
                                easy_us_1.$message.error({ content: msg, duration: 0 });
                                background_1.$console.log(msg);
                                common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, {
                                    duration: 0,
                                    extraTitle: '知道智慧树学习脚本'
                                });
                                return;
                            }
                            yield easy_us_1.$store.setTab('reload-count', (reload_count !== null && reload_count !== void 0 ? reload_count : 0) + 1);
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            setTimeout(() => {
                                location.reload();
                            }, 3000);
                        }
                        else {
                            const msg = '视频加载失败，即将跳过。';
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            next();
                        }
                    });
                    const doWork = () => __awaiter(this, void 0, void 0, function* () {
                        yield waitForCaptcha();
                        const set = () => __awaiter(this, void 0, void 0, function* () {
                            // 上面操作会导致元素刷新，这里重新获取视频
                            try {
                                yield easy_us_1.$.sleep(1000);
                                // 设置清晰度
                                yield processor.switchLine(this.cfg.definition || 'line1bq');
                                yield easy_us_1.$.sleep(1000);
                                // 设置播放速度
                                yield processor.switchPlaybackRate(this.cfg.playbackRate);
                                yield easy_us_1.$.sleep(1000);
                                const media = yield (0, study_1.waitForMedia)({ timeout: 5 * 1000, filter: (m) => m.src.length !== 0 });
                                yield easy_us_1.$.sleep(1000);
                                state.study.currentMedia = media;
                                if (media) {
                                    // 如果已经播放完了，则重置视频进度
                                    media.currentTime = 1;
                                    // 音量
                                    media.volume = this.cfg.volume;
                                }
                                return state.study.currentMedia;
                            }
                            catch (e) {
                                reload(e);
                            }
                        });
                        // 部分用户视频加载很慢，这里等待一下
                        try {
                            const media = yield (0, study_1.waitForMedia)({
                                timeout: 10 * 1000,
                                filter: (m) => m.src.length !== 0
                            });
                            media.pause();
                            // 固定进度条便于下方点击音量等按钮
                            fixProcessBar();
                        }
                        catch (e) {
                            reload(e);
                            return;
                        }
                        yield waitForCaptcha();
                        const video = yield set();
                        if (!video) {
                            return;
                        }
                        // 如果视频元素无法访问，证明已经切换了视频
                        const videoCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected)) {
                                clearInterval(videoCheckInterval);
                                easy_us_1.$message.info({ content: '检测到视频切换中...' });
                                /**
                                 * 元素无法访问证明用户切换视频了
                                 * 所以不往下播放视频，而是重新播放用户当前选中的视频
                                 */
                                doWork();
                            }
                        }), 3000);
                        easy_us_1.$message.info('开始播放');
                        (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play()).then(() => {
                            const current = document.querySelector('.chapter-item.current , .chapter-content-second.current');
                            const cn = current ? processor.getChapterName(current) : '未知章节';
                            easy_us_1.$message.info({ content: '正在学习：' + cn });
                            background_1.$console.log('正在学习：' + cn);
                        });
                        video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            if (!(video === null || video === void 0 ? void 0 : video.ended) && state.study.stop === false) {
                                yield easy_us_1.$.sleep(1000);
                                video === null || video === void 0 ? void 0 : video.play();
                            }
                        });
                        video.onended = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            easy_us_1.$message.info('即将自动跳转下一节');
                            background_1.$console.info('即将自动跳转下一节');
                            clearInterval(videoCheckInterval);
                            yield easy_us_1.$.sleep(3000);
                            yield next();
                        });
                    });
                    doWork();
                });
            }
        }),
        hike: new easy_us_1.Script({
            name: '🖥️ 教学空间-AI智慧课程-学习脚本',
            hideInPanel: true,
            matches: [
                ['学习首页', 'hike-teaching-center.polymas.com/stu-hike/agent-course-hike/ai-course-center'],
                ['学习页面', 'tools-hike/studentStudyResource']
            ],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                restudy: configs_1.restudy,
                reloadWhenError: zhs_configs_1.reloadWhenError,
                volume: configs_1.volume,
                definition: configs_1.definition,
                playbackRate: zhs_configs_1.playbackRate
            },
            oncomplete(...args) {
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsStudyConfigs)();
                    if (location.href.includes('stu-hike/agent-course-hike/ai-course-center')) {
                        easy_us_1.$message.info({ content: '请手动进入视频、作业、考试页面，脚本会自动运行。', duration: 60 });
                        return;
                    }
                    const processor = new Hike();
                    // 监听音量
                    this.onConfigChange('volume', (curr) => {
                        state.study.currentMedia && (state.study.currentMedia.volume = curr);
                    });
                    // 监听速度
                    this.onConfigChange('playbackRate', (curr) => __awaiter(this, void 0, void 0, function* () {
                        if (typeof curr === 'string') {
                            this.cfg.playbackRate = parseFloat(curr);
                        }
                        fixProcessBar();
                        processor.switchPlaybackRate(curr);
                    }));
                    // 监听清晰度
                    this.onConfigChange('definition', (curr) => __awaiter(this, void 0, void 0, function* () {
                        fixProcessBar();
                        processor.switchLine(curr);
                    }));
                    const getChapterName = () => { var _a, _b; return ((_b = (_a = document.querySelector('.active-file')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '未知章节'; };
                    const next = () => __awaiter(this, void 0, void 0, function* () {
                        const nextJob = processor.getNext({ next: true, restudy: this.cfg.restudy });
                        if (nextJob) {
                            nextJob.click();
                            yield easy_us_1.$.sleep(3000);
                            doWork();
                        }
                        else {
                            finishAlert();
                        }
                    });
                    const waitForLoad = () => {
                        return new Promise((resolve, reject) => {
                            const check = () => {
                                if (processor.hasJob()) {
                                    resolve();
                                }
                                else {
                                    setTimeout(check, 1000);
                                }
                            };
                            check();
                        });
                    };
                    yield waitForLoad();
                    yield easy_us_1.$.sleep(3000);
                    setInterval(() => {
                        // 定时显示进度条，防止消失
                        fixProcessBar();
                    }, 1000);
                    easy_us_1.$message.success({ content: '即将开始自动学习！' });
                    const reload = (e) => __awaiter(this, void 0, void 0, function* () {
                        background_1.$console.error(e);
                        if (this.cfg.reloadWhenError) {
                            const msg = '视频加载失败，即将刷新页面。';
                            const reload_count = yield easy_us_1.$store.getTab('reload-count');
                            if (reload_count && reload_count > 3) {
                                const msg = '视频加载失败/黑屏导致重新加载页面次数超过3次，请尝试关闭页面重新打开，或者检查网络连接！';
                                yield easy_us_1.$store.setTab('reload-count', 0);
                                easy_us_1.$message.error({ content: msg, duration: 0 });
                                background_1.$console.log(msg);
                                common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, {
                                    duration: 0,
                                    extraTitle: '知道智慧树学习脚本'
                                });
                                return;
                            }
                            yield easy_us_1.$store.setTab('reload-count', (reload_count !== null && reload_count !== void 0 ? reload_count : 0) + 1);
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            setTimeout(() => {
                                location.reload();
                            }, 3000);
                        }
                        else {
                            const msg = '视频加载失败，即将跳过。';
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            next();
                        }
                    });
                    const doWork = () => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c;
                        yield waitForCaptcha();
                        if (!((_c = (_b = (_a = document.querySelector('.active-file')) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement) === null || _c === void 0 ? void 0 : _c.querySelector('.icon-movie'))) {
                            easy_us_1.$message.warn('当前章节不支持学习，即将跳转下一节');
                            yield easy_us_1.$.sleep(3000);
                            yield next();
                            return;
                        }
                        const set = () => __awaiter(this, void 0, void 0, function* () {
                            // 上面操作会导致元素刷新，这里重新获取视频
                            try {
                                // 设置清晰度
                                yield processor.switchLine(this.cfg.definition || 'line1bq');
                                yield easy_us_1.$.sleep(1000);
                                // 设置播放速度
                                yield processor.switchPlaybackRate(this.cfg.playbackRate);
                                yield easy_us_1.$.sleep(1000);
                                const media = yield (0, study_1.waitForMedia)({ timeout: 5 * 1000, filter: (m) => m.src.length !== 0 });
                                yield easy_us_1.$.sleep(1000);
                                state.study.currentMedia = media;
                                if (media) {
                                    // 如果已经播放完了，则重置视频进度
                                    media.currentTime = 1;
                                    // 音量
                                    media.volume = this.cfg.volume;
                                }
                                return state.study.currentMedia;
                            }
                            catch (e) {
                                reload(e);
                            }
                        });
                        easy_us_1.$message.info('开始播放');
                        // 部分用户视频加载很慢，这里等待一下
                        try {
                            const media = yield (0, study_1.waitForMedia)({
                                timeout: 10 * 1000,
                                filter: (m) => m.src.length !== 0
                            });
                            media.pause();
                            // 固定进度条便于下方点击音量等按钮
                            fixProcessBar();
                        }
                        catch (e) {
                            reload(e);
                            return;
                        }
                        yield waitForCaptcha();
                        const video = yield set();
                        if (!video) {
                            return;
                        }
                        // 如果视频元素无法访问，证明已经切换了视频
                        const videoCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected)) {
                                clearInterval(videoCheckInterval);
                                easy_us_1.$message.info({ content: '检测到视频切换中...' });
                                /**
                                 * 元素无法访问证明用户切换视频了
                                 * 所以不往下播放视频，而是重新播放用户当前选中的视频
                                 */
                                doWork();
                            }
                        }), 3000);
                        (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play()).then(() => {
                            const cn = getChapterName();
                            easy_us_1.$message.info({ content: '正在学习：' + cn });
                            background_1.$console.log('正在学习：' + cn);
                        });
                        video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            if (!(video === null || video === void 0 ? void 0 : video.ended) && state.study.stop === false) {
                                yield easy_us_1.$.sleep(1000);
                                video === null || video === void 0 ? void 0 : video.play();
                            }
                        });
                        video.onended = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            easy_us_1.$message.info('即将自动跳转下一节');
                            background_1.$console.info('即将自动跳转下一节');
                            clearInterval(videoCheckInterval);
                            yield easy_us_1.$.sleep(3000);
                            yield next();
                        });
                    });
                    doWork();
                });
            }
        }),
        hike_v2: new easy_us_1.Script({
            name: '🖥️ 教学空间-AI智慧课程-学习脚本',
            hideInPanel: true,
            matches: [
                ['学习首页', /polymas.com\/stu-hike\/agent-course-full\/.*\/stu\/(course-home|study)/],
                ['学习页面', '/stu/study/resource-detail']
            ],
            namespace: config_migrate_1.zhsStudyNamespace,
            configs: {
                restudy: configs_1.restudy,
                reloadWhenError: zhs_configs_1.reloadWhenError,
                volume: configs_1.volume
            },
            oncomplete(...args) {
                var _a;
                (_a = this.onhistorychange) === null || _a === void 0 ? void 0 : _a.call(this, 'push', ...args);
            },
            onhistorychange(type) {
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.study 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsStudyConfigs)();
                    if (type !== 'push') {
                        return;
                    }
                    // 置顶当前脚本
                    if (!location.href.includes('stu/study/resource-detail')) {
                        easy_us_1.$message.info({ content: '请手动进入视频、作业、考试页面，脚本会自动运行。', duration: 60 });
                        return;
                    }
                    const processor = new HikeV2();
                    // 监听音量
                    this.onConfigChange('volume', (curr) => {
                        state.study.currentMedia && (state.study.currentMedia.volume = curr);
                    });
                    const next = () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        // 打开章节列表
                        (_a = document.querySelector('.drawer-panel')) === null || _a === void 0 ? void 0 : _a.classList.add('active');
                        const nextJob = processor.getNext({ next: true, restudy: this.cfg.restudy });
                        if (nextJob) {
                            nextJob.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            yield easy_us_1.$.sleep(200);
                            nextJob.click();
                            yield easy_us_1.$.sleep(3000);
                            doJob();
                        }
                        else {
                            finishAlert();
                        }
                    });
                    const waitForLoad = () => {
                        return new Promise((resolve, reject) => {
                            const check = () => {
                                if (processor.hasJob()) {
                                    resolve();
                                }
                                else {
                                    setTimeout(check, 1000);
                                }
                            };
                            check();
                        });
                    };
                    yield waitForLoad();
                    yield easy_us_1.$.sleep(3000);
                    easy_us_1.$message.success({ content: '即将开始自动学习！' });
                    const reload = (e) => __awaiter(this, void 0, void 0, function* () {
                        background_1.$console.error(e);
                        if (this.cfg.reloadWhenError) {
                            const msg = '视频加载失败，即将刷新页面。';
                            const reload_count = yield easy_us_1.$store.getTab('reload-count');
                            if (reload_count && reload_count > 3) {
                                const msg = '视频加载失败/黑屏导致重新加载页面次数超过3次，请尝试关闭页面重新打开，或者检查网络连接！';
                                yield easy_us_1.$store.setTab('reload-count', 0);
                                easy_us_1.$message.error({ content: msg, duration: 0 });
                                background_1.$console.log(msg);
                                common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, {
                                    duration: 0,
                                    extraTitle: '知道智慧树学习脚本'
                                });
                                return;
                            }
                            yield easy_us_1.$store.setTab('reload-count', (reload_count !== null && reload_count !== void 0 ? reload_count : 0) + 1);
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            setTimeout(() => {
                                location.reload();
                            }, 3000);
                        }
                        else {
                            const msg = '视频加载失败，即将跳过。';
                            easy_us_1.$message.error(msg);
                            background_1.$console.log(msg);
                            next();
                        }
                    });
                    const doJob = () => __awaiter(this, void 0, void 0, function* () {
                        yield waitForCaptcha();
                        if (!document.querySelector('.video-js')) {
                            easy_us_1.$message.warn('当前章节不支持学习，即将跳转下一节');
                            yield easy_us_1.$.sleep(3000);
                            yield next();
                            return;
                        }
                        const set = () => __awaiter(this, void 0, void 0, function* () {
                            // 上面操作会导致元素刷新，这里重新获取视频
                            try {
                                yield easy_us_1.$.sleep(1000);
                                const media = yield (0, study_1.waitForMedia)({ timeout: 5 * 1000, filter: (m) => m.src.length !== 0 });
                                yield easy_us_1.$.sleep(1000);
                                state.study.currentMedia = media;
                                if (media) {
                                    // 如果已经播放完了，则重置视频进度
                                    media.currentTime = 1;
                                    // 音量
                                    media.volume = this.cfg.volume;
                                }
                                return state.study.currentMedia;
                            }
                            catch (e) {
                                reload(e);
                            }
                        });
                        easy_us_1.$message.info('开始播放');
                        yield waitForCaptcha();
                        const video = yield set();
                        if (!video) {
                            return;
                        }
                        const video_src = video.src;
                        // 如果视频元素无法访问，证明已经切换了视频
                        const videoCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected) || video.src !== video_src) {
                                clearInterval(videoCheckInterval);
                                easy_us_1.$message.info({ content: '检测到视频切换中...' });
                                /**
                                 * 元素无法访问证明用户切换视频了
                                 * 所以不往下播放视频，而是重新播放用户当前选中的视频
                                 */
                                doJob();
                            }
                        }), 3000);
                        (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play()).then(() => {
                            const cn = processor.getChapterName();
                            easy_us_1.$message.info({ content: '正在学习：' + cn });
                            background_1.$console.log('正在学习：' + cn);
                        });
                        video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            if (!(video === null || video === void 0 ? void 0 : video.ended) && state.study.stop === false) {
                                yield easy_us_1.$.sleep(1000);
                                video === null || video === void 0 ? void 0 : video.play();
                            }
                        });
                        video.onended = () => __awaiter(this, void 0, void 0, function* () {
                            if (!(video === null || video === void 0 ? void 0 : video.isConnected))
                                return;
                            easy_us_1.$message.info('即将自动跳转下一节');
                            background_1.$console.info('即将自动跳转下一节');
                            clearInterval(videoCheckInterval);
                            yield easy_us_1.$.sleep(3000);
                            yield next();
                        });
                    });
                    doJob();
                });
            }
        }),
        'hike-work': new easy_us_1.Script({
            matches: [['AI教学中心-作业任务页面', '/stu-hike/stuHomeworkDo']],
            name: '✍️ 教学空间-AI智慧课程-作业考试脚本',
            hideInPanel: true,
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {
                workDelay: {
                    label: '作业答题开始时间延迟（秒）',
                    defaultValue: 3,
                    attrs: { type: 'number', min: 1, step: 1, max: 10 }
                }
            },
            oncomplete() {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.work 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsWorkConfigs)();
                    // 检查是否为软件环境
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    yield (0, study_1.waitForElement)('.q_main');
                    (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                        workerProvider: (opts) => {
                            return hikeWork(undefined, opts);
                        },
                        start_delay_seconds: (_a = this.cfg.workDelay) !== null && _a !== void 0 ? _a : 3
                    });
                });
            }
        }),
        'hike-homework': new easy_us_1.Script({
            matches: [
                ['AI教学中心-题目作业', '/stu/answer-homework'],
                ['AI教学中心-作业任务页面', '/stu-exam/answer-exam']
            ],
            name: '✍️ 教学空间-AI智慧课程-题目作业脚本',
            hideInPanel: true,
            namespace: config_migrate_1.zhsWorkNamespace,
            configs: {
                workDelay: {
                    label: '作业答题开始时间延迟（秒）',
                    defaultValue: 3,
                    attrs: { type: 'number', min: 1, step: 1, max: 10 }
                }
            },
            oncomplete() {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    // 迁移旧命名空间下的用户配置到统一的 zhs.work 命名空间（幂等，可安全重复调用）
                    (0, config_migrate_1.migrateZhsWorkConfigs)();
                    // 检查是否为软件环境
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    yield (0, study_1.waitForElement)('.question-item');
                    (0, work_1.commonWork)(exports.ZHSProject.scripts['work-center'], {
                        workerProvider: (opts) => {
                            return hikeHomework(undefined, opts);
                        },
                        start_delay_seconds: (_a = this.cfg.workDelay) !== null && _a !== void 0 ? _a : 3
                    });
                });
            }
        })
    }
});
/**
 * 观看视频
 * @param setting
 * @returns
 */
function watch(processor, options, actions) {
    return __awaiter(this, void 0, void 0, function* () {
        const reload = (e) => __awaiter(this, void 0, void 0, function* () {
            background_1.$console.error(e);
            if (options.reloadWhenError) {
                const msg = '视频加载失败，即将刷新页面。';
                const reload_count = yield easy_us_1.$store.getTab('reload-count');
                if (reload_count && reload_count > 3) {
                    const msg = '视频加载失败导致重新加载页面次数超过3次，请尝试关闭页面重新打开，或者检查网络连接！';
                    yield easy_us_1.$store.setTab('reload-count', 0);
                    easy_us_1.$message.error({ content: msg, duration: 0 });
                    background_1.$console.log(msg);
                    common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, {
                        duration: 0,
                        extraTitle: '知道智慧树学习脚本'
                    });
                    return;
                }
                yield easy_us_1.$store.setTab('reload-count', (reload_count !== null && reload_count !== void 0 ? reload_count : 0) + 1);
                easy_us_1.$message.error(msg);
                background_1.$console.log(msg);
                setTimeout(() => {
                    actions.reload();
                }, 5000);
            }
            else {
                const msg = '视频加载失败，即将跳过。';
                easy_us_1.$message.error(msg);
                background_1.$console.log(msg);
                actions.onended({ next: true });
            }
        });
        const set = () => __awaiter(this, void 0, void 0, function* () {
            // 上面操作会导致元素刷新，这里重新获取视频
            try {
                yield easy_us_1.$.sleep(1000);
                fixProcessBar();
                // 设置清晰度
                yield processor.switchLine(options.definition || 'line1bq');
                yield easy_us_1.$.sleep(1000);
                fixProcessBar();
                // 设置播放速度
                yield processor.switchPlaybackRate(options.playbackRate);
                yield easy_us_1.$.sleep(1000);
                const media = yield (0, study_1.waitForMedia)({ timeout: 10 * 1000 });
                yield easy_us_1.$.sleep(1000);
                state.study.currentMedia = media;
                if (media) {
                    // 如果已经播放完了，则重置视频进度
                    media.currentTime = 1;
                    // 音量
                    media.volume = options.volume;
                }
                return state.study.currentMedia;
            }
            catch (e) {
                return yield reload(e);
            }
        });
        easy_us_1.$message.info('开始播放');
        // 部分用户视频加载很慢，这里等待一下
        try {
            const media = yield (0, study_1.waitForMedia)({ timeout: 10 * 1000 });
            media.volume = options.volume;
            // 如果已经播放完了，则重置视频进度
            media.pause();
            // 固定进度条便于下方点击音量等按钮
            fixProcessBar();
        }
        catch (e) {
            return yield reload(e);
        }
        yield easy_us_1.$.sleep(1000);
        const video = yield set();
        if (!video) {
            return yield reload('视频加载失败');
        }
        const videoCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            // 如果视频元素无法访问，证明已经切换了视频
            if ((video === null || video === void 0 ? void 0 : video.isConnected) === false) {
                clearInterval(videoCheckInterval);
                easy_us_1.$message.info({ content: '检测到视频切换中...' });
                /**
                 * 元素无法访问证明用户切换视频了
                 * 所以不往下播放视频，而是重新播放用户当前选中的视频
                 */
                actions.onended({ next: false });
            }
        }), 3000);
        (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play());
        video.onpause = () => __awaiter(this, void 0, void 0, function* () {
            if (!(video === null || video === void 0 ? void 0 : video.ended) && state.study.stop === false) {
                yield waitForCaptcha();
                yield easy_us_1.$.sleep(1000);
                video === null || video === void 0 ? void 0 : video.play();
            }
        });
        video.onended = () => {
            clearInterval(videoCheckInterval);
            // 正常切换下一个视频
            actions.onended({ next: true });
        };
    });
}
/**
 * 观看校内课
 */
function watchXnk(options, onended) {
    return __awaiter(this, void 0, void 0, function* () {
        // 部分用户视频加载很慢，这里等待一下
        const media = yield (0, study_1.waitForMedia)();
        media.volume = options.volume;
        media.currentTime = 1;
        state.study.currentMedia = media;
        (0, utils_1.playMedia)(() => media === null || media === void 0 ? void 0 : media.play());
        media.onpause = () => __awaiter(this, void 0, void 0, function* () {
            if (!(media === null || media === void 0 ? void 0 : media.ended)) {
                yield easy_us_1.$.sleep(1000);
                media === null || media === void 0 ? void 0 : media.play();
            }
        });
        media.onended = () => {
            // 正常切换下一个视频
            onended();
        };
    });
}
/**
 * 检测是否有验证码，并等待验证
 */
function checkForCaptcha(update) {
    let modal;
    let notified = false;
    return setInterval(() => {
        if ((0, easy_us_1.$el)('.yidun_popup')) {
            update(true);
            // 如果弹窗不存在，则显示
            if (modal === undefined) {
                modal = easy_us_1.$modal.alert({ content: '当前检测到验证码，请输入后方可继续运行。' });
            }
            // 如果没有通知过，则通知
            if (!notified) {
                notified = true;
                common_1.CommonProject.scripts.settings.methods.notificationBySetting('智慧树脚本：当前检测到验证码，请输入后方可继续运行。', { duration: 0 });
            }
        }
        else {
            if (modal) {
                update(false);
                // 关闭弹窗
                modal.remove();
                modal = undefined;
            }
        }
    }, 1000);
}
function waitForCaptcha() {
    const popup = getPopupCaptcha();
    if (popup) {
        const message = easy_us_1.$message.warn({ content: '当前检测到验证码，请输入后方可继续运行。', duration: 0 });
        common_1.CommonProject.scripts.settings.methods.notificationBySetting('智慧树脚本：当前检测到验证码，请输入后方可继续运行。', { duration: 0 });
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const popup = getPopupCaptcha();
                if (popup === null) {
                    message === null || message === void 0 ? void 0 : message.remove();
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
    }
}
function getPopupCaptcha() {
    return document.querySelector('.yidun_popup');
}
/**
 * 共享课的作业和考试
 */
function gxkWorkAndExam(workInfo, { answererWrappers, period, thread, stopSecondWhenFinish, redundanceWordsText, answerSeparators }) {
    var _a, _b, _c;
    common_1.CommonProject.scripts.workResults.methods.init({
        questionPositionSyncHandlerType: 'zhs-gxk'
    });
    /**
     * workExamParts 是个列表
     * 里面包括一个题目类型的列表，第一个是单选，第二个是多选，第三个是判断
     * 所以这里直接扁平化数组方便处理
     */
    const allExamParts = ((_c = (((_b = (_a = workInfo === null || workInfo === void 0 ? void 0 : workInfo.rt) === null || _a === void 0 ? void 0 : _a.examBase) === null || _b === void 0 ? void 0 : _b.workExamParts) || [])) === null || _c === void 0 ? void 0 : _c.map((p) => p.questionDtos).flat()) || [];
    const titleTransform = (_, index) => {
        var _a;
        const div = (0, easy_us_1.h)('div');
        div.innerHTML = ((_a = allExamParts[index]) === null || _a === void 0 ? void 0 : _a.name) || '题目读取失败';
        const extracted = (0, work_1.extractTextWithImages)(div);
        return {
            text: (0, work_1.removeRedundantWords)(extracted.text || '', redundanceWordsText.split('\n')),
            images: extracted.images
        };
    };
    /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
    const titleText = (_, index) => titleTransform(_, index).text;
    /**
     * 选项内容提取：zhs 选项按钮也是图片，仅采集 .node_detail 内的图片；
     * 同时将 data-src 提升为 src（懒加载），替代旧 createUnVisibleTextOfImage 注入。
     */
    const optionExtract = (o) => (0, work_1.extractTextWithImages)(o, {
        imgFilter: (img) => {
            if (img.dataset.src)
                img.src = img.dataset.src;
            return !!img.closest('.node_detail');
        }
    });
    let request_index = 0;
    /** 新建答题器 */
    const worker = new core_1.OCSWorker({
        root: '.examPaper_subject',
        elements: {
            /**
             * .subject_describe > div: 选择题题目
             * .smallStem_describe > div:nth-child(2): 阅读理解小题题目
             */
            title: '.subject_describe > div,.smallStem_describe > div:nth-child(2)',
            // 选项元素：data-src→src 懒加载提升与图片过滤移入 work.optionText，不在选择器中改造 DOM
            options: '.subject_node .nodeLab'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: () => titleTransform(undefined, request_index++),
            optionsTransform: (elements, ctx) => {
                var _a;
                if (ctx.type === 'completion')
                    return '';
                const optResults = ((_a = ctx.elements.options) !== null && _a !== void 0 ? _a : []).filter(Boolean).map((o) => optionExtract(o));
                return {
                    text: optResults.map((r) => r.text).join('\n'),
                    images: optResults.flatMap((r) => r.images)
                };
            },
            answererWrappers,
            period
        }),
        work: {
            /** 选项文本提供器：替代 innerText，使图片 URL 进入匹配文本 */
            optionText: (o) => optionExtract(o).text,
            type(ctx) {
                var _a, _b, _c, _d;
                const type = (_d = (_c = (_b = (_a = ctx.elements.title[0].parentElement) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.querySelector('.subject_type')) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim();
                if (type === null || type === void 0 ? void 0 : type.includes('单选题')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选题')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断题')) {
                    return 'judgement';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('填空题')) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        if (!((_a = option.querySelector('input')) === null || _a === void 0 ? void 0 : _a.checked)) {
                            option.click();
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                    else if (type === 'completion' && answer.trim()) {
                        const text = option.querySelector('textarea');
                        if (text) {
                            text.value = answer;
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                });
            }
        },
        /** 完成答题后 */
        onResultsUpdate(curr, index, res) {
            var _a, _b;
            common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, titleText));
            if ((_a = curr.result) === null || _a === void 0 ? void 0 : _a.finish) {
                const title = (_b = allExamParts[index]) === null || _b === void 0 ? void 0 : _b.name;
                if (title) {
                    background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([curr], (_, __) => title));
                }
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    checkForCaptcha((hasCaptcha) => {
        if (hasCaptcha) {
            worker.emit('stop');
        }
        else {
            worker.emit('continuate');
        }
    });
    worker
        .doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug })
        .then((res) => __awaiter(this, void 0, void 0, function* () {
        var _d;
        // 如果被强制关闭，则不进行保存操作
        if (worker.isClose === true) {
            return;
        }
        easy_us_1.$message.success({ content: `答题完成，将等待 ${stopSecondWhenFinish} 秒后进行保存或提交。` });
        yield easy_us_1.$.sleep(stopSecondWhenFinish * 1000);
        // @ts-ignore
        if (worker.isClose === true) {
            return;
        }
        /**
         * 保存题目，不在选择答案后保存的原因是，如果答题线程大于3会导致题目错乱，因为 resolverIndex 并不是顺序递增的
         */
        for (let index = 0; index < worker.totalQuestionCount; index++) {
            // @ts-ignore
            if (worker.isClose === true) {
                return;
            }
            const modal = easy_us_1.$modal.alert({
                title: '⚠️提示',
                content: `正在自动保存题目中，不然填写的答案将无效，<br>当前进度 ${index}/${worker.totalQuestionCount}<br>保存完毕前请勿操作...`,
                confirmButton: null,
                maskCloseable: false
            });
            yield waitForCaptcha();
            yield easy_us_1.$.sleep(2000);
            // 跳转到该题目，防止用户在保存时切换题目
            (_d = document.querySelectorAll('.answerCard_list ul li').item(index)) === null || _d === void 0 ? void 0 : _d.click();
            yield easy_us_1.$.sleep(200);
            // 下一页
            const next = (0, easy_us_1.$el)('div.examPaper_box > div.switch-btn-box > button:nth-child(2)');
            if (next) {
                next.click();
            }
            else {
                background_1.$console.error('未找到下一页按钮。');
            }
            modal === null || modal === void 0 ? void 0 : modal.remove();
        }
        easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
    }))
        .catch((err) => {
        easy_us_1.$message.error({ content: '答题程序发生错误 : ' + err.message, duration: 0 });
    });
    return worker;
}
/**
 * 校内学分课的作业
 */
function xnkWork({ answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    const titleTransform = (titles) => {
        return titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t).text : ''))
            .join(',');
    };
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    const worker = new core_1.OCSWorker({
        // .questionBox 有两个同样的，这里选择具有直接子元素questionContent的div元素，保证题目唯一
        root: 'div:has(> .questionContent)' /** .questionBox */,
        elements: {
            title: '.questionContent',
            options: '.optionUl label',
            questionTit: '.questionTit'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransform(elements.title),
            answererWrappers,
            period
        }),
        work: {
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        if (((_a = option.querySelector('input')) === null || _a === void 0 ? void 0 : _a.checked) === false) {
                            option.click();
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                    else if (type === 'completion' && answer.trim()) {
                        const text = option.querySelector('textarea');
                        if (text) {
                            text.value = answer;
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                });
            }
        },
        /**
         * 因为校内课的考试和作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(current) {
            (0, work_1.updateDynamicResult)(current, titleTransform);
        },
        onResultsUpdate(current, _, res) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(current, titleTransform);
            if (current.result) {
                totalQuestionCount++;
                requestedCount++;
                resolvedCount++;
            }
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkState({
                totalQuestionCount,
                requestedCount,
                resolvedCount
            });
        }
    });
    const getBtn = () => document.querySelector('span.Topicswitchingbtn:nth-child(2)');
    let next = getBtn();
    (() => __awaiter(this, void 0, void 0, function* () {
        while (next && worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            yield easy_us_1.$.sleep(1000);
            next = getBtn();
            next === null || next === void 0 ? void 0 : next.click();
            yield easy_us_1.$.sleep(1000);
        }
        easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
        // 答题完成后，题库选项点击才会同步题目，否则会导致题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'zhs-xnk';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
/**
 * 智慧课程的作业
 */
function smartWork(remotePage, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    const titleTransformWithImages = (titles) => {
        const results = titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t) : { text: '', images: [] }));
        return {
            text: results.map((r) => r.text).join(','),
            images: results.flatMap((r) => r.images)
        };
    };
    const titleTransform = (titles) => titleTransformWithImages(titles).text;
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    const worker = new core_1.OCSWorker({
        root: '.questionContent',
        elements: {
            title: '.questionName .centent-pre',
            options: '.radio-view li.clearfix, .checkbox-views label.el-checkbox, .fillAnswer'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransformWithImages(elements.title),
            optionsTransform: (elements, ctx) => {
                var _a;
                if (ctx.type === 'completion')
                    return '';
                const optResults = ((_a = ctx.elements.options) !== null && _a !== void 0 ? _a : []).filter(Boolean).map((o) => (0, work_1.extractTextWithImages)(o));
                return {
                    text: optResults.map((r) => r.text).join('\n'),
                    images: optResults.flatMap((r) => r.images)
                };
            },
            answererWrappers,
            period
        }),
        work: {
            /** 选项文本提供器：替代 innerText，使图片 URL 进入匹配文本 */
            optionText: (o) => (0, work_1.extractTextWithImages)(o).text,
            type(ctx) {
                var _a, _b, _c;
                const type = (_c = (_b = (_a = ctx.elements.title[0]) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.querySelector('.letterSortNum')) === null || _c === void 0 ? void 0 : _c.textContent;
                if (type === null || type === void 0 ? void 0 : type.includes('单选题')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选题')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断题')) {
                    return 'judgement';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('填空')) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        const opt = option.querySelector('.el-checkbox__input:not(.is-checked),i.iconfont:not(.checkedIcon)');
                        if (opt) {
                            if (remotePage) {
                                yield remotePage.click(opt);
                            }
                            else {
                                opt.click();
                            }
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                    else if (type === 'completion') {
                        const opt = option.querySelector('input');
                        if (opt && answer.trim()) {
                            if (remotePage) {
                                yield remotePage.click(opt);
                                opt.value = '';
                                yield remotePage['keyboard.type'](answer, { delay: Math.floor(Math.random() * 100) });
                            }
                            else {
                                opt.value = answer;
                            }
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                });
            }
        },
        /**
         * 作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(current) {
            (0, work_1.updateDynamicResult)(current, titleTransform);
        },
        onResultsUpdate(current, _, res) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(current, titleTransform);
            if (current.result) {
                totalQuestionCount++;
                requestedCount++;
                resolvedCount++;
            }
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkState({
                totalQuestionCount,
                requestedCount,
                resolvedCount
            });
        }
    });
    const getNextBtn = () => document.querySelector('.next-topic.next-t');
    let next = null;
    (() => __awaiter(this, void 0, void 0, function* () {
        // 从第一题开始
        const first = document.querySelector('[role="treeitem"] .font-sec-style-node');
        if (first) {
            if (remotePage)
                yield remotePage.click(first);
            else
                first.click();
            yield easy_us_1.$.sleep(3000);
        }
        let count = 0;
        while (worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            next = getNextBtn();
            if (!next) {
                break;
            }
            yield easy_us_1.$.sleep(1000);
            if (remotePage)
                yield remotePage.click(next);
            else
                next.click();
            // 等待题目加载
            yield easy_us_1.$.sleep(1000);
            count++;
        }
        easy_us_1.$message.info({
            content: '作业/考试完成，请自行检查后保存或提交。',
            duration: 
            // 题目过多则不自动关闭
            count > 10 ? 0 : 30
        });
        worker.emit('done');
        // 答题完成后，题库选项点击才会同步题目，否则会导致题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'zhs-smart';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
function smartExam(remotePage, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    const titleTransformWithImages = (titles) => {
        const results = titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t) : { text: '', images: [] }));
        return {
            text: results.map((r) => r.text).join(','),
            images: results.flatMap((r) => r.images)
        };
    };
    const titleTransform = (titles) => titleTransformWithImages(titles).text;
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    const worker = new core_1.OCSWorker({
        root: '.question-area-content',
        elements: {
            type: 'div.flex.items-center.mb-\\[16px\\]',
            title: 'div.flex-1 .mb-\\[32px\\] .text-mainText.font-medium',
            options: 'label.user-select.group,div.real-editor'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransformWithImages(elements.title),
            optionsTransform: (elements, ctx) => {
                var _a;
                if (ctx.type === 'completion')
                    return '';
                const optResults = ((_a = ctx.elements.options) !== null && _a !== void 0 ? _a : []).filter(Boolean).map((o) => (0, work_1.extractTextWithImages)(o));
                return {
                    text: optResults.map((r) => r.text).join('\n'),
                    images: optResults.flatMap((r) => r.images)
                };
            },
            answererWrappers,
            period
        }),
        work: {
            /** 选项文本提供器：替代 innerText，使图片 URL 进入匹配文本 */
            optionText: (o) => (0, work_1.extractTextWithImages)(o).text,
            type(ctx) {
                const type = ctx.elements.type[0].textContent;
                if (type === null || type === void 0 ? void 0 : type.includes('单选')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选题')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断')) {
                    return 'judgement';
                }
                else if ((type === null || type === void 0 ? void 0 : type.includes('填空')) || (type === null || type === void 0 ? void 0 : type.includes('问答'))) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        // mainBg 为已经选择的选项的背景色，未选择的选项没有这个类
                        if (option.querySelector('div.bg-mainBg') === null) {
                            if (remotePage) {
                                yield remotePage.click(option);
                            }
                            else {
                                option.click();
                            }
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                    else if (type === 'completion') {
                        // 简答
                        if (option.classList.contains('real-editor')) {
                            // @ts-ignore
                            option.ckeditorInstance.data.set(answer);
                        }
                        else {
                            const input = option.querySelector('input');
                            if (input) {
                                input.value = answer;
                                Reflect.set(input, 'composition', true);
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        }
                        yield easy_us_1.$.sleep(200);
                    }
                });
            }
        },
        /**
         * 作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(current) {
            (0, work_1.updateDynamicResult)(current, titleTransform);
        },
        onResultsUpdate(current, _, res) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(current, titleTransform);
            if (current.result) {
                totalQuestionCount++;
                requestedCount++;
                resolvedCount++;
            }
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkState({
                totalQuestionCount,
                requestedCount,
                resolvedCount
            });
        }
    });
    const getNextBtn = () => Array.from(document.querySelectorAll('button')).find((btn) => { var _a; return (_a = btn.textContent) === null || _a === void 0 ? void 0 : _a.includes('下一题'); });
    let next = null;
    (() => __awaiter(this, void 0, void 0, function* () {
        // 从第一题开始
        const first = document.querySelector('.grid.grid-cols-7 > button');
        if (first) {
            if (remotePage)
                yield remotePage.click(first);
            else
                first.click();
            yield easy_us_1.$.sleep(3000);
        }
        let count = 0;
        while (worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            next = getNextBtn();
            if (!next) {
                break;
            }
            yield easy_us_1.$.sleep(1000);
            if (remotePage)
                yield remotePage.click(next);
            else
                next.click();
            // 等待题目加载
            yield easy_us_1.$.sleep(1000);
            count++;
        }
        easy_us_1.$message.info({
            content: '作业/考试完成，请自行检查后保存或提交。',
            duration: 
            // 题目过多则不自动关闭
            count > 10 ? 0 : 30
        });
        worker.emit('done');
        // 答题完成后，题库选项点击才会同步题目，否则会导致题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'zhs-smart';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
function fusioncourseWork(remotePage, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    common_1.CommonProject.scripts.workResults.methods.init({
        questionPositionSyncHandlerType: 'zhs-fusion'
    });
    const titleTransform = (titles) => {
        return titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t).text : ''))
            .join(',');
    };
    const worker = new core_1.OCSWorker({
        root: '.exam-item',
        // 元素观察器：页面 hash 跳转/任务点切换导致作业 iframe 重建、
        // 题目容器脱离文档时，自动关闭答题并警告（3 秒阈值覆盖正常切题重渲染）
        rootObserver: {
            enabled: true,
            onRootLost: () => {
                // 关闭答题的同时清空搜索结果面板与计数，避免残留过期结果
                common_1.CommonProject.scripts.workResults.methods.clearResults();
                common_1.CommonProject.scripts.workResults.methods.refreshState();
            }
        },
        elements: {
            type: '.quest-type',
            title: '.quest-title .option-name',
            options: 'label'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransform(elements.title),
            answererWrappers,
            period
        }),
        work: {
            type(ctx) {
                const type = ctx.elements.type[0].textContent;
                if (type === null || type === void 0 ? void 0 : type.includes('单选题')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选题')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断题')) {
                    return 'judgement';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('填空题')) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        const opt = option.querySelector('.el-checkbox__input:not(.is-checked),.el-radio__input:not(.is-checked)');
                        if (opt) {
                            if (remotePage) {
                                yield remotePage.click(opt);
                            }
                            else {
                                opt.click();
                            }
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                });
            }
        },
        /**
         * 作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        onResultsUpdate(current, _, res) {
            var _a;
            if (current.result) {
                common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, titleTransform));
            }
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    worker
        .doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug })
        .then((res) => __awaiter(this, void 0, void 0, function* () {
        // 如果被强制关闭，则不进行保存操作
        if (worker.isClose === true) {
            return;
        }
        // @ts-ignore
        if (worker.isClose === true) {
            return;
        }
        easy_us_1.$message.info({
            content: '作业/考试完成，请自行检查后保存或提交。',
            // 题目过多则不自动关闭
            duration: res.length > 10 ? 0 : 30
        });
        worker.emit('done');
    }))
        .catch((err) => {
        easy_us_1.$message.error({ content: '答题程序发生错误 : ' + err.message, duration: 0 });
    });
    return worker;
}
function hikeWork(remotePage, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({
        questionPositionSyncHandlerType: 'zhs-hike',
        dynamic: true
    });
    const titleTransform = (titles) => {
        return titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t).text : ''))
            .join(',');
    };
    const worker = new core_1.OCSWorker({
        root: '.q_main',
        elements: {
            type: '.question_score',
            title: '.question-topic',
            options: 'label'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransform(elements.title),
            answererWrappers,
            period
        }),
        work: {
            type(ctx) {
                const type = ctx.elements.type[0].textContent;
                if (type === null || type === void 0 ? void 0 : type.includes('单选题')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选题')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断题')) {
                    return 'judgement';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('填空题')) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        const opt = option.querySelector('.el-checkbox__input:not(.is-checked),.el-radio__input:not(.is-checked)');
                        if (opt) {
                            if (remotePage) {
                                yield remotePage.click(opt);
                            }
                            else {
                                opt.click();
                            }
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                });
            }
        },
        /**
         * 作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(current) {
            (0, work_1.updateDynamicResult)(current, titleTransform);
        },
        onResultsUpdate(current, _, res) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(current, titleTransform);
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    const getNextBtn = () => document.querySelector('.check_btn:not(.is-disabled)');
    let next = getNextBtn();
    let count = 0;
    (() => __awaiter(this, void 0, void 0, function* () {
        // 从第一题开始
        const first = document.querySelector('.card_ul .card_li');
        if (first) {
            if (remotePage)
                yield remotePage.click(first);
            else
                first.click();
            yield easy_us_1.$.sleep(3000);
        }
        while (next && worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            next = getNextBtn();
            if (next) {
                yield easy_us_1.$.sleep(1000);
                if (remotePage)
                    yield remotePage.click(next);
                else
                    next.click();
                // 等待题目加载
                yield easy_us_1.$.sleep(1000);
                count++;
            }
        }
        easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: count > 10 ? 0 : 30 });
        worker.emit('done');
        // 答题完成后，题库选项点击才会同步题目，否则会导致题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'zhs-hike';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
function hikeHomework(remotePage, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    // CommonProject.scripts.workResults.methods.init({
    // 	questionPositionSyncHandlerType: 'zhs-hike'
    // });
    const titleTransform = (titles) => {
        return titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => (t ? (0, work_1.extractTextWithImages)(t).text : ''))
            .join(',');
    };
    const worker = new core_1.OCSWorker({
        root: '.question-item',
        elements: {
            type: '.title-box,.combination-title',
            title: '.qeustion-content , .combination-content ',
            options: '.option-item, .vditor-content'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransform(elements.title),
            answererWrappers,
            period
        }),
        work: {
            type(ctx) {
                const type = ctx.elements.type[0].textContent;
                if (type === null || type === void 0 ? void 0 : type.includes('单选')) {
                    return 'single';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('多选')) {
                    return 'multiple';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('判断')) {
                    return 'judgement';
                }
                else if (type === null || type === void 0 ? void 0 : type.includes('问答')) {
                    return 'completion';
                }
                else {
                    return undefined;
                }
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        if (remotePage) {
                            yield remotePage.click(option);
                        }
                        else {
                            option.click();
                        }
                        yield easy_us_1.$.sleep(200);
                    }
                    else if (type === 'completion') {
                        const textarea = option.querySelector('.vditor-reset');
                        if (textarea)
                            textarea.innerHTML = `<p data-block="0">${answer.trim()}</p>`;
                    }
                });
            }
        },
        /**
         * 作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        onResultsUpdate(current, _, res) {
            var _a;
            if (current.result) {
                common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, titleTransform));
            }
            if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug }).then(() => {
        easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
        // 答题完成后，题库选项点击才会同步题目，否则会导致题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'zhs-hike';
    });
    return worker;
}
/**
 * 将秒数转换为小时或分钟
 * @param second 秒
 */
function optimizeSecond(second) {
    if (second > 3600) {
        return `${Math.floor(second / 3600)}小时${Math.floor((second % 3600) / 60)}分钟`;
    }
    else if (second > 60) {
        return `${Math.floor(second / 60)}分钟${second % 60}秒`;
    }
    else {
        return `${second}秒`;
    }
}
function autoStop(stopTime) {
    var _a, _b;
    clearInterval(state.study.stopInterval);
    (_a = state.study.stopMessage) === null || _a === void 0 ? void 0 : _a.remove();
    if (stopTime !== '0') {
        let stopCount = parseFloat(stopTime) * 60 * 60;
        state.study.stopInterval = setInterval(() => {
            var _a;
            if (stopCount > 0) {
                // 如果有弹窗验证码则暂停自动停止的计时
                if (getPopupCaptcha() === null) {
                    stopCount--;
                }
            }
            else {
                clearInterval(state.study.stopInterval);
                state.study.stop = true;
                (_a = (0, easy_us_1.$el)('video')) === null || _a === void 0 ? void 0 : _a.pause();
                easy_us_1.$modal.alert({ content: '脚本暂停，已获得今日平时分，如需继续观看，请刷新页面。' });
            }
        }, 1000);
        // 从配置的 options 中校验当前定时值是否合法（keep 与 stopTime.options 定义同步）
        const val = ((_b = (exports.ZHSProject.scripts['gxk-study'].configs.stopTime.options || []).find((t) => t[0] === stopTime)) === null || _b === void 0 ? void 0 : _b[0]) || '0';
        const date = new Date();
        date.setMinutes(date.getMinutes() + parseFloat(val) * 60);
        state.study.stopMessage = easy_us_1.$message.info({
            duration: 0,
            content: `在 ${date.toLocaleTimeString()} 脚本将自动暂停`
        });
    }
}
/** 学习/视频界面所需的最小分辨率（宽 x 高） */
const MIN_VIEWPORT_WIDTH = 1280;
const MIN_VIEWPORT_HEIGHT = 720;
/**
 * 检测智慧树学习/视频界面的分辨率，如果低于 1280x720，
 * 则弹窗提示用户，点击确定后自动调整缩放以达到最小要求。
 *
 * 说明：分辨率过小会导致页面元素重叠/遮挡，影响学习、播放等自动点击功能。
 */
function ensureWideViewport() {
    const { innerWidth: width, innerHeight: height } = window;
    if (width >= MIN_VIEWPORT_WIDTH && height >= MIN_VIEWPORT_HEIGHT) {
        return;
    }
    easy_us_1.$modal.confirm({
        title: '界面分辨率提示',
        content: (0, easy_us_1.h)('div', {}, [
            '当前界面分辨率过小，可能影响学习、播放等自动点击功能，点击确定自动调整界面尺寸。',
            (0, easy_us_1.h)('div', { style: { fontSize: '12px', color: '#999', marginTop: '8px' } }, '如需恢复请刷新界面')
        ]),
        confirmButtonText: '确定',
        cancelButtonText: '暂不调整',
        onConfirm: () => {
            adjustViewportScale(width, height);
        }
    });
}
/**
 * 通过 html 的 zoom 缩放样式，把界面调整到满足 1280x720 最小分辨率要求。
 * 缩放比例取宽、高两个方向所需缩放中的较大值，确保两个方向都满足最小要求。
 */
function adjustViewportScale(width, height) {
    const scale = Math.min(1, Math.min(width / MIN_VIEWPORT_WIDTH, height / MIN_VIEWPORT_HEIGHT));
    if (scale >= 1) {
        return;
    }
    const styleId = 'ocs-viewport-scale-style';
    let style = document.getElementById(styleId);
    if (style === null) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.append(style);
    }
    style.innerText = `html { zoom: ${scale}; }`;
    easy_us_1.$message.success({
        duration: 5,
        content: `已自动调整缩放至 ${Math.round(scale * 100)}%，以满足 1280x720 最小分辨率要求`
    });
}
/** 固定视频进度 */
function fixProcessBar() {
    const bar = document.querySelector('.controlsBar');
    if (bar) {
        bar.style.display = 'block';
        // 适配 wisdomh5
        bar.style.zIndex = '2';
        bar.style.overflow = '';
    }
}
function closeDialogRead() {
    const div = document.querySelector('.dialog-read');
    if (div) {
        div.style.display = 'none';
    }
}
function finishAlert() {
    easy_us_1.$modal.alert({
        content: '检测到当前视频全部播放完毕，如果还有未完成的视频请刷新重试，或者打开复习模式。'
    });
}
