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
exports.IcveMoocProject = void 0;
const core_1 = require("@ocsjs/core");
const easy_us_1 = require("easy-us");
const work_1 = require("../utils/work");
const configs_1 = require("../utils/configs");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const common_1 = require("./common");
const background_1 = require("./background");
const study_1 = require("../utils/study");
const state = {
    study: {
        currentMedia: undefined,
        currentStudyLockId: 0,
        playbackRateWarningListenerId: 0,
        courseLengthListenerId: 0
    }
};
const $msg_and_log = (type, msg) => {
    easy_us_1.$message[type](msg);
    background_1.$console[type](msg);
};
/**
 * 学习锁，用于判断是否可以学习，防止学习函数被多次调用
 */
class StudyLock {
    constructor() {
        StudyLock.auto_inc++;
        this.id = StudyLock.auto_inc;
        state.study.currentStudyLockId = this.id;
    }
    canStudy() {
        return this.id === state.study.currentStudyLockId;
    }
    static getLock() {
        return new StudyLock();
    }
}
StudyLock.auto_inc = 0;
exports.IcveMoocProject = easy_us_1.Project.create({
    name: '智慧职教',
    domains: [
        'icve.com.cn',
        'ai.icve.com.cn',
        'course.icve.com.cn',
        // 智慧职教套壳
        'courshare.cn',
        'webtrn.cn'
    ],
    scripts: {
        guide: new easy_us_1.Script({
            name: '💡 使用提示',
            matches: [
                ['个人首页', 'icve.com.cn/studycenter'],
                ['学习页面', 'icve.com.cn/study/directory'],
                ['MOOC学院-个人首页', 'user.icve.com.cn'],
                ['MOOC学院-首页', 'mooc.icve.com.cn'],
                ['AI课程首页', 'ai.icve.com.cn/app/my-excellent-home']
            ],
            namespace: 'icve.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['点击任意课程进入', '点击任意章节进入学习', '等待脚本自动运行']).outerHTML
                }
            },
            oncomplete() {
                background_1.BackgroundProject.scripts.render.methods.pin(this);
            }
        }),
        /** 智慧职教学习中心 */
        studyCenter: new easy_us_1.Script({
            name: '🖥️ 智慧职教-学习中心',
            namespace: 'icve.study.center',
            matches: [
                ['学习中心页面', '/study/directory/dir_course.html'],
                ['课程列表', 'icve.com.cn/study/directory/directory_list.html']
            ],
            configs: {
                playbackRate: configs_1.playbackRate,
                volume: configs_1.volume,
                /** 章节列表 */
                currentCourseUrlList: {
                    defaultValue: []
                }
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (location.href.includes('icve.com.cn/study/directory/directory_list.html')) {
                        yield (0, study_1.waitForElement)('.h_cells a');
                        this.cfg.currentCourseUrlList = Array.from(document.querySelectorAll('.h_cells a')).map((a) => a.href);
                        return;
                    }
                    if (this.cfg.currentCourseUrlList.length === 0) {
                        try {
                            const url = 'https://www.icve.com.cn/study/directory/directory_list.html?courseId=' +
                                new URL(location.href).searchParams.get('courseId');
                            const res = yield fetch(url).then((res) => res.text());
                            const doc = new DOMParser().parseFromString(res, 'text/html');
                            this.cfg.currentCourseUrlList = Array.from(doc.querySelectorAll('.h_cells a')).map((a) => a.href);
                        }
                        catch (e) {
                            console.error(e);
                            easy_us_1.$message.error('课程列表获取失败，请刷新页面重试。');
                            return;
                        }
                    }
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    this.onConfigChange('playbackRate', (playbackRate) => {
                        state.study.currentMedia && (state.study.currentMedia.playbackRate = parseFloat(playbackRate.toString()));
                    });
                    this.onConfigChange('volume', (v) => state.study.currentMedia && (state.study.currentMedia.volume = v));
                    const study = () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const res = yield Promise.race([(0, study_1.waitForElement)('video, audio'), (0, study_1.waitForElement)('.docBox')]);
                        if (res) {
                            const jobName = ((_a = document.querySelector('.tabsel.seled')) === null || _a === void 0 ? void 0 : _a.getAttribute('title')) || '-';
                            easy_us_1.$message.info('开始任务：' + jobName);
                            background_1.$console.log(`任务 ${jobName} 开始。`);
                            if (document.querySelector('video, audio')) {
                                const media = yield (0, study_1.waitForMedia)();
                                state.study.currentMedia = media;
                                media.volume = this.cfg.volume;
                                yield new Promise((resolve, reject) => {
                                    try {
                                        console.log(document.hasFocus());
                                        window.focus();
                                        // @ts-ignore
                                        easy_us_1.$gm.unsafeWindow.jwplayer().onComplete(() => __awaiter(this, void 0, void 0, function* () {
                                            background_1.$console.log('视频/音频播放完成。');
                                            yield core_1.$.sleep(3000);
                                            resolve();
                                        }));
                                        const play = () => {
                                            easy_us_1.$gm.unsafeWindow.jwplayer().play();
                                            easy_us_1.$gm.unsafeWindow.jwplayer().play();
                                            media.playbackRate = parseFloat(this.cfg.playbackRate.toString());
                                        };
                                        media.addEventListener('pause', () => __awaiter(this, void 0, void 0, function* () {
                                            if (!media.ended) {
                                                yield core_1.$.sleep(1000);
                                                (0, utils_1.playMedia)(play);
                                            }
                                        }));
                                        // 开始播放
                                        (0, utils_1.playMedia)(play);
                                    }
                                    catch (err) {
                                        reject(err);
                                    }
                                });
                            }
                            easy_us_1.$message.success(`任务 ${jobName} 完成，三秒后下一章`);
                            background_1.$console.log(`任务 ${jobName} 完成，三秒后下一章`);
                        }
                        else {
                            background_1.$console.error(`不支持的任务页面，请跟作者进行反馈。三秒后下一章`);
                        }
                        yield core_1.$.sleep(3000);
                        next();
                    });
                    const next = () => {
                        for (let index = 0; index < this.cfg.currentCourseUrlList.length; index++) {
                            const url = this.cfg.currentCourseUrlList[index];
                            const nextUrl = this.cfg.currentCourseUrlList[index + 1];
                            if (new URL(url).hash === new URL(location.href).hash) {
                                if (!nextUrl) {
                                    easy_us_1.$modal.alert({ content: '全部任务已完成' });
                                    common_1.CommonProject.scripts.settings.methods.notificationBySetting('全部任务点已完成！', {
                                        duration: 0,
                                        extraTitle: '智慧职教学习脚本'
                                    });
                                    return;
                                }
                                else {
                                    window.location.href = this.cfg.currentCourseUrlList[index + 1];
                                }
                            }
                        }
                    };
                    study();
                });
            }
        }),
        /** MOOC 学院 */
        study: new easy_us_1.Script({
            name: '🖥️ MOOC学院-课程学习',
            namespace: 'icve.study.main',
            matches: [['课程学习页面', '/learnspace/learn/learn/templateeight/index.action']],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '如果视频无法播放，可以手动点击其他任务跳过视频。',
                        '经过测试视频倍速最多二倍，否则会判定无效。',
                        '手动进入作业页面才能使用自动答题。'
                    ]).outerHTML
                },
                playbackRate: configs_1.playbackRate,
                volume: configs_1.volume,
                restudy: configs_1.restudy,
                showScrollBar: {
                    label: '显示右侧滚动条',
                    attrs: { type: 'checkbox' },
                    defaultValue: true
                },
                expandAll: {
                    label: '展开所有章节',
                    attrs: { type: 'checkbox' },
                    defaultValue: true
                },
                switchPeriod: {
                    label: '下一章节切换间隔（秒）',
                    defaultValue: 10,
                    attrs: {
                        type: 'number',
                        min: 0,
                        max: 999,
                        step: 1
                    }
                }
            },
            onrender() {
                // 高倍速警告
                this.offConfigChange(state.study.playbackRateWarningListenerId);
                state.study.playbackRateWarningListenerId =
                    this.onConfigChange('playbackRate', (playbackRate) => {
                        if (playbackRate > 4) {
                            easy_us_1.$modal.alert({
                                title: '⚠️高倍速警告',
                                content: easy_us_1.$ui.notes(['高倍速可能导致视频无法完成！'])
                            });
                        }
                    }) || 0;
            },
            oncomplete() {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    yield core_1.$.sleep(3000);
                    this.onConfigChange('volume', (v) => state.study.currentMedia && (state.study.currentMedia.volume = v));
                    this.onConfigChange('playbackRate', (r) => state.study.currentMedia && (state.study.currentMedia.playbackRate = parseFloat(r.toString())));
                    const mainContentWin = (_a = (0, easy_us_1.$el)('#mainContent')) === null || _a === void 0 ? void 0 : _a.contentWindow;
                    if (mainContentWin) {
                        // 弹窗强制用户点击，防止视频无法自动播放
                        easy_us_1.$modal.confirm({
                            content: (0, easy_us_1.h)('div', [
                                '是否开始自动学习当前章节？',
                                (0, easy_us_1.h)('br'),
                                '你也可以选择任意的章节进行点击，脚本会自动学习，并一直往下寻找章节。'
                            ]),
                            cancelButtonText: '我想手动选择章节',
                            confirmButtonText: '开始学习',
                            onConfirm() {
                                return __awaiter(this, void 0, void 0, function* () {
                                    study(StudyLock.getLock());
                                    scrollToJob();
                                });
                            }
                        });
                    }
                    if (this.cfg.showScrollBar) {
                        const bar = (0, easy_us_1.$el)('.dumascroll_area', mainContentWin.document);
                        bar && (bar.style.overflow = 'auto');
                    }
                    if (this.cfg.expandAll) {
                        (0, easy_us_1.$$el)('.s_sectionlist,.s_sectionwrap', mainContentWin.document).forEach((el) => (el.style.display = 'block'));
                    }
                    for (const job of (0, easy_us_1.$$el)('.s_point[itemtype]', mainContentWin.document)) {
                        job.addEventListener('click', (e) => {
                            const lock = StudyLock.getLock();
                            // 如果是用户点击
                            if (e.isTrusted) {
                                if (job.getAttribute('itemtype') === 'exam') {
                                    return easy_us_1.$message.info({
                                        duration: 60,
                                        content: '检测到您手动选择了作业/考试章节，将不会自动跳转，请完成后手动选择其他章节，脚本会自动学习。'
                                    });
                                }
                                else {
                                    easy_us_1.$message.info('检测到章节切换，即将自动学习...');
                                }
                            }
                            setTimeout(() => {
                                study(lock);
                            }, 3000);
                        });
                    }
                    const scrollToJob = () => { var _a; return (_a = (0, easy_us_1.$el)('.s_pointerct', mainContentWin.document)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
                    /** 学习 */
                    const study = (studyLock) => __awaiter(this, void 0, void 0, function* () {
                        var _b;
                        const iframe = (0, easy_us_1.$el)('iframe', mainContentWin.document);
                        const win = iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow;
                        if (win) {
                            const doc = win.document;
                            if (iframe.src.includes('content_video.action') || iframe.src.includes('content_audio.action')) {
                                // 视频
                                background_1.$console.log('视频/音频播放中...');
                                try {
                                    const media = yield (0, study_1.waitForMedia)({ root: doc });
                                    state.study.currentMedia = media;
                                    media.playbackRate = parseFloat(this.cfg.playbackRate.toString());
                                    media.volume = this.cfg.volume;
                                    media.currentTime = 0;
                                    yield new Promise((resolve, reject) => {
                                        try {
                                            // @ts-ignore
                                            win.jwplayer().onComplete(() => __awaiter(this, void 0, void 0, function* () {
                                                background_1.$console.log('视频/音频播放完成。');
                                                yield core_1.$.sleep(3000);
                                                resolve();
                                            }));
                                            media.addEventListener('pause', () => __awaiter(this, void 0, void 0, function* () {
                                                if (!media.ended) {
                                                    yield Promise.race([
                                                        // 测验弹窗
                                                        waitForPopupQuestion(doc),
                                                        // 30分钟是否继续学习弹窗
                                                        handleContinueDialog()
                                                    ]);
                                                    yield core_1.$.sleep(1000);
                                                    (0, utils_1.playMedia)(() => media.play());
                                                }
                                            }));
                                            // 开始播放
                                            (0, utils_1.playMedia)(() => media.play());
                                        }
                                        catch (err) {
                                            reject(err);
                                        }
                                    });
                                }
                                catch (err) {
                                    easy_us_1.$message.error(String(err));
                                }
                            }
                            else if (iframe.src.includes('content_doc.action')) {
                                // 文档只需点击就算完成，等待5秒下一个
                                yield core_1.$.sleep(5000);
                            }
                        }
                        else {
                            // 如果为 null 证明跨域
                        }
                        background_1.$console.log(this.cfg.switchPeriod + ' 秒后切换下一章节。');
                        yield core_1.$.sleep(this.cfg.switchPeriod * 1000);
                        if (studyLock.canStudy()) {
                            let nextEl;
                            // 是否处于当前章节之后
                            let isBellowCurrentJob = false;
                            const jobs = (0, easy_us_1.$$el)('.s_point[itemtype]', mainContentWin.document);
                            for (let index = 0; index < jobs.length; index++) {
                                const job = jobs[index];
                                if (job.classList.contains('s_pointerct')) {
                                    isBellowCurrentJob = true;
                                }
                                else if (isBellowCurrentJob) {
                                    if (job.querySelector('.done_icon_show') === null || this.cfg.restudy) {
                                        background_1.$console.log('下一章：', job.title || ((_b = (0, easy_us_1.$el)('.s_pointti', job)) === null || _b === void 0 ? void 0 : _b.title) || '未知');
                                        nextEl = job;
                                        break;
                                    }
                                }
                            }
                            if (nextEl) {
                                nextEl.click();
                                scrollToJob();
                            }
                            else {
                                easy_us_1.$modal.alert({ content: '全部任务已完成' });
                                common_1.CommonProject.scripts.settings.methods.notificationBySetting('全部任务点已完成！', {
                                    duration: 0,
                                    extraTitle: '智慧职教学习脚本'
                                });
                            }
                        }
                    });
                });
            }
        }),
        work: new easy_us_1.Script({
            name: '✍️ 作业考试脚本',
            matches: [['作业考试页面', '/exam']],
            namespace: 'icve.work',
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '自动答题前请在 “通用-全局设置” 中设置题库配置。',
                        '可以搭配 “通用-在线搜题” 一起使用。',
                        '请手动进入作业考试页面才能使用自动答题。'
                    ]).outerHTML
                }
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    easy_us_1.$message.warn({ content: '自动答题时请勿切换题目，否则可能导致重复搜题或者脚本卡主。', duration: 0 });
                    // 回到第一题
                    const resetToBegin = () => {
                        var _a;
                        (_a = document.querySelectorAll(`.sheet_nums [id*="sheetSeq"]`).item(0)) === null || _a === void 0 ? void 0 : _a.click();
                    };
                    (0, work_1.commonWork)(this, {
                        workerProvider: work,
                        beforeRunning: () => __awaiter(this, void 0, void 0, function* () {
                            resetToBegin();
                            yield core_1.$.sleep(1000);
                        }),
                        onRestart: () => resetToBegin()
                    });
                });
            }
        }),
        workDispatcher: new easy_us_1.Script({
            name: '作业调度脚本',
            matches: [
                ['作业进入页面', '/platformwebapi/student/exam/'],
                ['确认作业页面', '/student/exam/studentExam_studentInfo.action']
            ],
            hideInPanel: true,
            oncomplete() {
                if (/\/platformwebapi\/student\/exam/.test(window.location.href)) {
                    easy_us_1.cors.on('icve-work-start', () => {
                        setTimeout(() => {
                            easy_us_1.$gm.unsafeWindow.openExamInfo();
                        }, 3000);
                    });
                }
                if (/\/student\/exam\/studentExam_studentInfo.action/.test(window.location.href)) {
                    setTimeout(() => {
                        // 确认答题后，OCS会自动执行 ICVE.scripts.work 的 oncomplete 然后开始答题
                        easy_us_1.$gm.unsafeWindow.enterExamPage();
                    }, 3000);
                }
            }
        }),
        'ai-study': new easy_us_1.Script({
            name: '🖥️ AI课程',
            namespace: 'icve.ai.study',
            matches: [
                ['课程页面', 'ai.icve.com.cn/app/coursedetails-excellent'],
                ['课程页面', 'ai.icve.com.cn/app/my-excellent-home'],
                ['学习页面', 'ai.icve.com.cn/excellent-study']
            ],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        [
                            '如果脚本卡死或者您不想学习，',
                            '可以点击其他任意章节继续进行学习。',
                            'PPT请勿加快点击，否则可能无法记录学习进度。'
                        ]
                    ]).outerHTML
                },
                volume: configs_1.volume,
                playbackRate: {
                    label: '视频倍速',
                    tag: 'select',
                    options: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 6, 8, 16].map((rate) => [
                        rate.toString(),
                        rate + ' x'
                    ]),
                    defaultValue: '1'
                },
                autoOpenAllChapter: {
                    label: '自动打开全部章节',
                    attrs: {
                        title: '如果没有打开全部章节，那么当任务点达到当前章节最后一个时将无法跳转到其他章节列表！',
                        type: 'checkbox'
                    },
                    defaultValue: true
                },
                restudy: configs_1.restudy
            },
            // historychange 不知道为什么会触发很多次在 kcnr 课程页面，这里直接 reload，让脚本加载 oncomplete 函数
            onhistorychange(type) {
                if (type !== 'replace') {
                    return;
                }
                if (location.href.includes('kcnr')) {
                    location.reload();
                }
            },
            oncomplete(type) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (document.location.href.includes('ai.icve.com.cn/app/my-excellent-home')) {
                        return easy_us_1.$message.info('点击任意课程开始自动学习');
                    }
                    // 置顶页面
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    this.onConfigChange('volume', (val) => {
                        if (state.study.currentMedia) {
                            state.study.currentMedia.volume = parseFloat(val.toString());
                        }
                    });
                    this.onConfigChange('playbackRate', (val) => {
                        if (state.study.currentMedia) {
                            state.study.currentMedia.playbackRate = parseFloat(val.toString());
                        }
                    });
                    // 等待加载
                    const waitForLoad = () => {
                        return new Promise((resolve) => {
                            const check = () => {
                                if (document.querySelector('.contentBox')) {
                                    resolve();
                                }
                                else {
                                    setTimeout(check, 100);
                                }
                            };
                            check();
                        });
                    };
                    // 删除是否继续学习的弹窗
                    const closeStudyContinueDialog = () => {
                        return new Promise((resolve) => {
                            let stop = false;
                            const check = () => {
                                var _a, _b;
                                if (document.querySelector('.el-message-box__wrapper')) {
                                    (_a = (0, easy_us_1.$el)('.el-message-box__wrapper')) === null || _a === void 0 ? void 0 : _a.remove();
                                    (_b = (0, easy_us_1.$el)('.v-modal')) === null || _b === void 0 ? void 0 : _b.remove();
                                    resolve();
                                }
                                else {
                                    !stop && setTimeout(check, 100);
                                }
                            };
                            check();
                            // 超时
                            setTimeout(() => {
                                stop = true;
                                resolve();
                            }, 3 * 1000);
                        });
                    };
                    yield waitForLoad();
                    yield closeStudyContinueDialog();
                    yield waitForLoad();
                    yield core_1.$.sleep(3000);
                    $msg_and_log('info', '即将打开全部章节列表，请稍等');
                    // 打开全部章节列表
                    const openAllChapter = () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const model = easy_us_1.$modal.simple({
                            maskCloseable: false,
                            footer: undefined,
                            content: '正在展开全部章节列表，请耐心等待不要操作...'
                        });
                        // 选择未展开的章节
                        const not_scrolled_titles = Array.from(document.querySelectorAll('.one-title')).filter((el) => !el.querySelector('.zhankai'));
                        const waitForChapterOpen = (title) => {
                            return new Promise((resolve) => {
                                let stop = false;
                                const check = () => {
                                    var _a;
                                    const parent = (_a = title.parentElement) === null || _a === void 0 ? void 0 : _a.parentElement;
                                    const content = parent === null || parent === void 0 ? void 0 : parent.querySelector('.panel-content');
                                    if ((content === null || content === void 0 ? void 0 : content.style.display) !== 'none' && ((content === null || content === void 0 ? void 0 : content.querySelectorAll('.node').length) || 0) > 0) {
                                        resolve();
                                    }
                                    else {
                                        !stop && setTimeout(check, 100);
                                    }
                                };
                                check();
                                // 超时
                                setTimeout(() => {
                                    stop = true;
                                    resolve();
                                }, 10 * 1000);
                            });
                        };
                        for (const nst of not_scrolled_titles) {
                            try {
                                (_a = nst.querySelector('.jiantou')) === null || _a === void 0 ? void 0 : _a.click();
                                nst.focus();
                                nst.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                yield waitForChapterOpen(nst);
                                yield core_1.$.sleep(1000);
                            }
                            catch (e) {
                                background_1.$console.error('打开章节失败', e);
                            }
                        }
                        model === null || model === void 0 ? void 0 : model.remove();
                    });
                    if (this.cfg.autoOpenAllChapter)
                        yield openAllChapter();
                    let study_id = '';
                    document.querySelectorAll('.node').forEach((el) => {
                        el.addEventListener('click', () => {
                            study((study_id = Math.random().toString(36).substr(2, 9)));
                        });
                    });
                    const study = (id) => __awaiter(this, void 0, void 0, function* () {
                        var _b;
                        $msg_and_log('info', '即将开始学习：' + (((_b = (0, easy_us_1.$el)('.contentBox')) === null || _b === void 0 ? void 0 : _b.__vue__.nrdata.name) || '未知任务点'));
                        yield core_1.$.sleep(3000);
                        yield (() => __awaiter(this, void 0, void 0, function* () {
                            var _c;
                            const active = document.querySelector('.panelList .node.active');
                            active === null || active === void 0 ? void 0 : active.focus();
                            active === null || active === void 0 ? void 0 : active.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            if ((active === null || active === void 0 ? void 0 : active.querySelector('.wc')) && !this.cfg.restudy) {
                                return $msg_and_log('info', '当前任务已完成，即将跳过');
                            }
                            const vue = (_c = (0, easy_us_1.$el)('.FilePreview')) === null || _c === void 0 ? void 0 : _c.__vue__;
                            const img = (0, easy_us_1.$el)('.ql-editor');
                            const work = (0, easy_us_1.$el)('.shiti');
                            if (work) {
                                // 做作业
                                return $msg_and_log('warn', '检测到当前为作业任务，请完成课程后手动进入自动答题。');
                            }
                            else if (img) {
                                // 做作业
                                return $msg_and_log('warn', '检测到当前为图片任务，即将跳过');
                            }
                            else {
                                if (!vue) {
                                    return easy_us_1.$message.error({ content: '获取课程数据失败，或者未知任务点，即将跳过' });
                                }
                                const watchOffice = () => __awaiter(this, void 0, void 0, function* () {
                                    const total = vue.photoList.length;
                                    for (let index = 0; index < total + 1; index++) {
                                        if (id !== study_id)
                                            return;
                                        vue.next();
                                        yield core_1.$.sleep(3000);
                                    }
                                });
                                easy_us_1.$message.info('开始学习');
                                if (['video', 'audio'].includes(vue.curType)) {
                                    yield closeStudyContinueDialog();
                                    yield watchMedia();
                                }
                                else if (['office', 'ppt'].includes(vue.curType)) {
                                    yield watchOffice();
                                    if (id !== study_id)
                                        return;
                                    yield core_1.$.sleep(1000);
                                }
                                else {
                                    $msg_and_log('warn', '未知的任务点，即将跳过');
                                }
                            }
                        }))();
                        if (id !== study_id)
                            return;
                        const next = getNext();
                        if (!next) {
                            return $msg_and_log('warn', '没有找到下一章节！');
                        }
                        $msg_and_log('info', '即将进入下一章节');
                        yield core_1.$.sleep(3000);
                        if (id !== study_id)
                            return;
                        next.click();
                    });
                    const getNext = () => {
                        const list = Array.from(document.querySelectorAll('.panelList .node'));
                        for (let index = 0; index < list.length; index++) {
                            const element = list[index];
                            if (element.classList.contains('active')) {
                                return list[index + 1];
                            }
                        }
                    };
                    study(study_id);
                });
            }
        }),
        'ai-work': new easy_us_1.Script({
            name: '✍️ AI作业',
            namespace: 'icve.ai.work',
            matches: [['作业页面', 'ai.icve.com.cn/preview-exam']],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '自动答题前请在 “通用-全局设置” 中设置题库配置。',
                        '可以搭配 “通用-在线搜题” 一起使用。',
                        '请手动进入作业考试页面才能使用自动答题。',
                        '自动答题时请勿切换题目，否则可能导致重复搜题或者脚本卡主！'
                    ]).outerHTML
                }
            },
            oncomplete() {
                easy_us_1.$message.warn({ content: '自动答题时请勿切换题目，否则可能导致重复搜题或者脚本卡主。', duration: 0 });
                // 回到第一题
                const resetToBegin = () => {
                    var _a;
                    (_a = document.querySelectorAll(`.list-box span`).item(0)) === null || _a === void 0 ? void 0 : _a.click();
                };
                (0, work_1.commonWork)(this, {
                    workerProvider: aiWork,
                    beforeRunning: () => __awaiter(this, void 0, void 0, function* () {
                        resetToBegin();
                        yield core_1.$.sleep(1000);
                    }),
                    onRestart: () => resetToBegin()
                });
            }
        })
    }
});
function watchMedia() {
    return __awaiter(this, void 0, void 0, function* () {
        const media = yield (0, study_1.waitForMedia)();
        media.volume = parseFloat(exports.IcveMoocProject.scripts['ai-study'].cfg.volume.toString());
        media.playbackRate = parseFloat(exports.IcveMoocProject.scripts['ai-study'].cfg.playbackRate.toString());
        state.study.currentMedia = media;
        const success = yield (0, utils_1.playMedia)(() => media.play());
        if (!success) {
            return;
        }
        return new Promise((resolve, reject) => {
            media.addEventListener('ended', () => {
                resolve();
            });
            media.addEventListener('pause', () => {
                setTimeout(() => {
                    if (media.ended) {
                        resolve();
                    }
                    else if (media.paused) {
                        media.play();
                        media.volume = parseFloat(exports.IcveMoocProject.scripts['ai-study'].cfg.volume.toString());
                        media.playbackRate = parseFloat(exports.IcveMoocProject.scripts['ai-study'].cfg.playbackRate.toString());
                    }
                }, 1000);
            });
        });
    });
}
function work({ answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info('开始作业');
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    console.log({ answererWrappers, period, thread });
    const titleTransformWithImages = (titles) => {
        const images = [];
        const text = titles
            .filter((t) => (t === null || t === void 0 ? void 0 : t.innerText) || (t === null || t === void 0 ? void 0 : t.querySelector('img')))
            .map((t) => {
            var _a, _b;
            if (t) {
                const title = t.cloneNode(true);
                (_a = title.querySelector('[name*="questionIndex"]')) === null || _a === void 0 ? void 0 : _a.remove();
                (_b = title.querySelector('.q_score')) === null || _b === void 0 ? void 0 : _b.remove();
                const extracted = (0, work_1.extractTextWithImages)(title);
                images.push(...extracted.images);
                return extracted.text.trim().replace(/^、/, '') || '';
            }
            return '';
        })
            .join(',');
        return { text, images };
    };
    /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
    const titleTransform = (titles) => titleTransformWithImages(titles).text;
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    function getType(options) {
        const radio_len = options
            .map((o) => o.querySelector('[type="radio"]'))
            .reduce((a, b) => {
            return a + (b ? 1 : 0);
        }, 0);
        return radio_len > 0
            ? radio_len === 2
                ? 'judgement'
                : 'single'
            : options.some((o) => o.querySelector('[type="checkbox"]'))
                ? 'multiple'
                : options.some((o) => o.querySelector('textarea'))
                    ? 'completion'
                    : options.some((o) => o.querySelector('.fillblank_input input'))
                        ? 'fill-blank'
                        : undefined;
    }
    const worker = new core_1.OCSWorker({
        root: '.q_content',
        elements: {
            title: '.divQuestionTitle, ' +
                // 单行填空题
                '[name="fillblankTitle"]',
            options: '.questionOptions .q_option, .questionOptions.divTextarea, ' +
                // 单行填空题
                '.answerOption'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements, _ctx) => titleTransformWithImages(elements.title),
            optionsTransform: (elements, ctx) => {
                var _a;
                const type = getType(ctx.elements.options) || 'unknown';
                ctx.type = type;
                if (type === 'completion')
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
        work(ctx) {
            return __awaiter(this, void 0, void 0, function* () {
                const options = ctx.elements.options;
                const type = getType(options);
                if (!type) {
                    throw new Error('无法获取题目类型！');
                }
                if (type === 'fill-blank') {
                    const inputs = options
                        .map((o) => Array.from(o.querySelectorAll('.fillblank_input input')))
                        .flat();
                    for (const searchInfo of ctx.searchInfos) {
                        for (const result of searchInfo.results) {
                            const answers = (0, core_1.splitAnswer)(result.answer);
                            if (answers.length === inputs.length) {
                                for (let index = 0; index < inputs.length; index++) {
                                    inputs[index].value = answers[index];
                                }
                                return { finish: true };
                            }
                        }
                    }
                }
                else {
                    /** 选项文本提供器：替代 innerText，使图片 URL 进入匹配文本 */
                    const resolver = (0, core_1.createDefaultQuestionResolver)(ctx, (o) => (0, work_1.extractTextWithImages)(o).text)[type];
                    const res = yield resolver(ctx.searchInfos, ctx.elements.options, (type, answer, option) => {
                        var _a, _b;
                        if (type === 'judgement' || type === 'single' || type === 'multiple') {
                            // 这里只用判断多选题是否选中，如果选中就不用再点击了，单选题是 radio，所以不用判断。
                            if (option.querySelector('.checkbox_on') === null) {
                                (_a = (0, easy_us_1.$el)('div', option)) === null || _a === void 0 ? void 0 : _a.click();
                            }
                        }
                        else if (type === 'completion' && answer.trim()) {
                            const text = option.querySelector('textarea');
                            const textIframe = option.querySelector('iframe[id*="ueditor"]');
                            if (text) {
                                text.value = answer;
                            }
                            if (textIframe) {
                                const view = (_b = textIframe.contentWindow) === null || _b === void 0 ? void 0 : _b.document.querySelector('body.view > p');
                                if (view) {
                                    view.innerText = answer;
                                }
                            }
                        }
                    });
                    return res;
                }
                return { finish: false };
            });
        },
        onElementSearched(elements, root) {
            console.log('elements', elements);
        },
        /**
         * 因为校内课的考试和作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(currentResult) {
            (0, work_1.updateDynamicResult)(currentResult, titleTransform);
        },
        onResultsUpdate(currentResult) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(currentResult, titleTransform);
            if (currentResult.resolved) {
                totalQuestionCount++;
                requestedCount++;
                resolvedCount++;
                if ((_a = currentResult.result) === null || _a === void 0 ? void 0 : _a.finish) {
                    background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([currentResult], titleTransform));
                }
                common_1.CommonProject.scripts.workResults.methods.updateWorkState({
                    totalQuestionCount,
                    requestedCount,
                    resolvedCount
                });
            }
        }
    });
    const getNextBtn = () => document.querySelector('.paging_next');
    let next = getNextBtn();
    (() => __awaiter(this, void 0, void 0, function* () {
        while (next && worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            yield core_1.$.sleep(1000);
            next = getNextBtn();
            if (next.style.display === 'none') {
                break;
            }
            else {
                next === null || next === void 0 ? void 0 : next.click();
                yield core_1.$.sleep(1000);
            }
        }
        easy_us_1.$message.success({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
        // 搜索完成后才会同步答案与题目的显示，防止题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'icve';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
function aiWork({ answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info('开始作业');
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    console.log({ answererWrappers, period, thread });
    const titleTransform = (titles) => {
        const images = [];
        const text = titles
            .filter((t) => (t === null || t === void 0 ? void 0 : t.innerText) || (t === null || t === void 0 ? void 0 : t.querySelector('img')))
            .map((t) => {
            if (t) {
                // 结构化遍历提取文本与图片 URL（不改造 DOM、不读 innerText/textContent）
                const extracted = (0, work_1.extractTextWithImages)(t);
                images.push(...extracted.images);
                return extracted.text.replace(/\s+/g, ' ').trim() || '';
            }
            return '';
        })
            .join(',');
        return { text, images };
    };
    /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
    const titleText = (titles) => titleTransform(titles).text;
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    function getType(options) {
        const radio_len = options
            .map((o) => o.querySelector('[type="radio"]'))
            .reduce((a, b) => {
            return a + (b ? 1 : 0);
        }, 0);
        return radio_len > 0
            ? radio_len === 2
                ? 'judgement'
                : 'single'
            : options.some((o) => o.querySelector('[type="checkbox"]'))
                ? 'multiple'
                : options.some((o) => o.querySelector('textarea')) || options.some((o) => o.classList.contains('ivu-input'))
                    ? 'completion'
                    : options.some((o) => o.querySelector('.fillblank_input input'))
                        ? 'fill-blank'
                        : undefined;
    }
    const worker = new core_1.OCSWorker({
        root: '.content-item',
        elements: {
            title: '.questions-content [class*=title-content]',
            options: 'label[class*=group-item],.ivu-input-wrapper input'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements, _ctx) => titleTransform(elements.title),
            optionsTransform: (elements, ctx) => {
                ctx.type = getType(ctx.elements.options) || 'unknown';
                const optResults = ctx.elements.options.map((o) => (0, work_1.extractTextWithImages)(o));
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
            type: (ctx) => {
                return getType(ctx.elements.options);
            },
            handler(type, answer, option, ctx) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        // 这里只用判断多选题是否选中，如果选中就不用再点击了，单选题是 radio，所以不用判断。
                        if (option.querySelector('.ivu-radio-checked') === null) {
                            option === null || option === void 0 ? void 0 : option.click();
                        }
                    }
                    else if (type === 'completion' && answer.trim()) {
                        if (option.tagName === 'INPUT') {
                            option.focus();
                            yield core_1.$.sleep(100);
                            // @ts-ignore
                            option.value = answer.trim();
                            yield core_1.$.sleep(100);
                            option.dispatchEvent(new Event('input', { bubbles: true }));
                            yield core_1.$.sleep(100);
                            option.blur();
                            yield core_1.$.sleep(100);
                        }
                    }
                });
            }
        },
        onElementSearched(elements, root) {
            console.log('elements', elements);
        },
        /**
         * 因为校内课的考试和作业都是一题一题做的，不像其他自动答题一样可以获取全部试卷内容。
         * 所以只能根据自定义的状态进行搜索结果的显示。
         */
        // 检测到题目即在结果面板占位（等待搜索中），随后状态推进原地更新
        onQuestionDetected(currentResult) {
            (0, work_1.updateDynamicResult)(currentResult, titleText);
        },
        onResultsUpdate(currentResult) {
            var _a;
            // 逐题更新搜索结果面板（等待搜索中→等待答题中→已答题/失败）
            (0, work_1.updateDynamicResult)(currentResult, titleText);
            if (currentResult.resolved) {
                totalQuestionCount++;
                requestedCount++;
                resolvedCount++;
                if ((_a = currentResult.result) === null || _a === void 0 ? void 0 : _a.finish) {
                    background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([currentResult], titleText));
                }
                common_1.CommonProject.scripts.workResults.methods.updateWorkState({
                    totalQuestionCount,
                    requestedCount,
                    resolvedCount
                });
            }
        }
    });
    const getNextBtn = () => document.querySelector('div.center_btn > button:nth-child(2)');
    let next = getNextBtn();
    (() => __awaiter(this, void 0, void 0, function* () {
        while (next && worker.isClose === false) {
            yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            yield core_1.$.sleep(1000);
            next = getNextBtn();
            if (next.getAttribute('disabled')) {
                break;
            }
            else {
                next === null || next === void 0 ? void 0 : next.click();
                yield core_1.$.sleep(1000);
            }
        }
        easy_us_1.$message.success({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
        // 搜索完成后才会同步答案与题目的显示，防止题目错乱
        common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'icve';
    }))();
    (0, work_1.dynamicWorkTips)(worker);
    return worker;
}
/**
 * 等待弹出的答题框，并点击确定
 */
function waitForPopupQuestion(dom) {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            var _a, _b;
            const el = (0, easy_us_1.$el)('.popup-test', dom);
            if (el) {
                clearInterval(interval);
                const right_answer = ((_a = (0, easy_us_1.$el)('#right_answer', el)) === null || _a === void 0 ? void 0 : _a.value) || 'A';
                for (const answer of right_answer.split('')) {
                    const item = (0, easy_us_1.$el)(`li.test-item-cell[curval="${answer}"]`, el);
                    item === null || item === void 0 ? void 0 : item.click();
                }
                (_b = (0, easy_us_1.$el)('[name="save_btn"]', el)) === null || _b === void 0 ? void 0 : _b.click();
                setTimeout(() => {
                    var _a;
                    (_a = (0, easy_us_1.$el)('[name="continue_btn"]', el)) === null || _a === void 0 ? void 0 : _a.click();
                    resolve();
                }, 3000);
            }
        }, 1000);
        setTimeout(() => {
            clearInterval(interval);
            resolve();
            console.log('未找到弹窗，继续执行');
        }, 60 * 1000);
    });
}
function handleContinueDialog() {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const el = document.querySelector('.layui-layer-btn0');
            if (el) {
                el.click();
                setTimeout(() => {
                    clearInterval(interval);
                    resolve();
                }, 1000);
            }
        }, 3000);
        setTimeout(() => {
            clearInterval(interval);
            resolve();
            console.log('未找到弹窗，继续执行');
        }, 60 * 1000);
    });
}
