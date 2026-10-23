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
exports.ICourseProject = void 0;
const core_1 = require("@ocsjs/core");
const easy_us_1 = require("easy-us");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const common_1 = require("./common");
const work_1 = require("../utils/work");
const background_1 = require("./background");
const app_1 = require("../utils/app");
const study_1 = require("../utils/study");
const configs_1 = require("../utils/configs");
const render_1 = require("../utils/render");
const $msg_and_log = (type, msg) => {
    easy_us_1.$message[type](msg);
    background_1.$console[type](msg);
};
const state = {
    currentMedia: undefined,
    currentUrlHash: '',
    currentRunningScriptName: '',
    current_job_id: ''
};
exports.ICourseProject = easy_us_1.Project.create({
    name: '中国大学MOOC',
    domains: ['icourse163.org'],
    scripts: {
        dispatcher: new easy_us_1.Script({
            name: '调度器',
            hideInPanel: true,
            matches: [['所有页面', 'icourse163.org']],
            oncomplete() {
                setInterval(() => {
                    var _a, _b;
                    const hash = new URL(window.location.href).hash;
                    if (state.currentUrlHash !== hash) {
                        state.currentRunningScriptName = '';
                    }
                    state.currentUrlHash = hash;
                    for (const key in exports.ICourseProject.scripts) {
                        if (Object.prototype.hasOwnProperty.call(exports.ICourseProject.scripts, key)) {
                            const script = exports.ICourseProject.scripts[key];
                            const runAtHash = Array.isArray(script.cfg.runAtHash) ? script.cfg.runAtHash : [script.cfg.runAtHash];
                            if (runAtHash.length && runAtHash.some((h) => state.currentUrlHash.includes(h))) {
                                if (state.currentRunningScriptName !== script.name) {
                                    state.currentRunningScriptName = script.name;
                                    state.current_job_id = Math.random().toString(16).slice(2);
                                    (_b = (_a = script.methods) === null || _a === void 0 ? void 0 : _a.main) === null || _b === void 0 ? void 0 : _b.call(_a, {
                                        canRun: () => {
                                            return state.currentUrlHash && runAtHash.some((h) => state.currentUrlHash.includes(h));
                                        },
                                        job_id: state.current_job_id
                                    });
                                }
                                break;
                            }
                        }
                    }
                }, 1000);
            }
        }),
        guide: new easy_us_1.Script({
            name: '💡 使用提示',
            matches: [['', 'icourse163.org']],
            // 添加版本号是因为只有 notes 会强制更新，其他配置项不会，如果需要修改 runAtHash ，需要更新版本号
            namespace: 'icourse.guide-v1',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['登录网课平台', '进入任意课程的课件/作业界面', '等待脚本自动运行']).outerHTML
                },
                runAtHash: {
                    // 在没有进入学习页面前，都显示提示
                    defaultValue: ['/home/course']
                }
            },
            methods() {
                return {
                    main: () => __awaiter(this, void 0, void 0, function* () {
                        console.log(state, this.cfg.runAtHash);
                        background_1.BackgroundProject.scripts.render.methods.pin(this);
                    })
                };
            }
        }),
        study: new easy_us_1.Script({
            name: '🖥️ 学习脚本',
            // 添加版本号是因为只有 notes 会强制更新，其他配置项不会，如果需要修改 runAtHash ，需要更新版本号
            namespace: 'icourse.study-v1',
            matches: [
                ['MOOC作业页面', 'icourse163.org/learn'],
                ['SPOC作业页面', 'icourse163.org/spoc/learn']
            ],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '请勿在使用过程中最小化浏览器',
                        '自动讨论默认关闭，如需开启请在下方设置中设置',
                        '作业请完成课程后手动进入'
                    ]).outerHTML
                },
                runAtHash: {
                    defaultValue: '/learn/content?type=detail'
                },
                playbackRate: configs_1.playbackRate,
                volume: configs_1.volume,
                readSpeed: {
                    label: 'PPT翻阅速度（秒）',
                    attrs: { type: 'number', step: '1', min: '1', max: '10' },
                    defaultValue: 1
                },
                discussionStrategy: {
                    label: '讨论自动回复方式',
                    tag: 'select',
                    defaultValue: 'not-reply',
                    options: [
                        ['not-reply', '不讨论回复'],
                        ['max-show-up', '获取出现最多的评论进行回复'],
                        ['max-fav', '获取最多点赞的评论进行回复'],
                        ['use-newest', '获取最新的评论进行回复']
                    ]
                },
                enableChapterTest: {
                    label: '随堂测验自动答题',
                    attrs: {
                        type: 'checkbox',
                        title: '是否开启随堂测验自动答题，默认关闭，测试时只需点击即可完成测验，但这里保留选项防止需要开启。'
                    },
                    defaultValue: false
                }
            },
            oncomplete() {
                this.onConfigChange('playbackRate', (playbackRate) => {
                    state.currentMedia && (state.currentMedia.playbackRate = parseFloat(playbackRate.toString()));
                });
                this.onConfigChange('volume', (v) => state.currentMedia && (state.currentMedia.volume = v));
            },
            methods() {
                return {
                    main: ({ canRun, job_id }) => __awaiter(this, void 0, void 0, function* () {
                        const remotePage = yield background_1.BackgroundProject.scripts.dev.methods.getRemotePlaywrightCurrentPage();
                        // 检查是否为软件环境
                        if (!remotePage) {
                            return app_1.$playwright.showError();
                        }
                        // 移动窗口到边缘
                        render_1.$render.moveToEdge();
                        /**
                         * 处理视频弹窗题目
                         */
                        const handleVideoTest = () => __awaiter(this, void 0, void 0, function* () {
                            if (!canRun() || job_id !== state.current_job_id)
                                return;
                            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                const question = document.querySelector('.u-questionItem');
                                const media = document.querySelector('video,audio');
                                if (question && media) {
                                    $msg_and_log('info', '检测到视频弹窗测验，开始答题');
                                    yield new Promise((resolve) => {
                                        exports.ICourseProject.scripts.work.methods.start('chapter-test', canRun, (worker) => {
                                            console.log('worker', worker);
                                            worker.once('done', resolve);
                                            worker.once('close', resolve);
                                            worker.once('stop', resolve);
                                        });
                                    });
                                    yield core_1.$.sleep(1000);
                                    // 点击继续学习
                                    yield remotePage.click('.j-unitctBox .u-btn-default.j-continue');
                                    $msg_and_log('info', '测验完成');
                                }
                                handleVideoTest();
                            }), 3000);
                        });
                        handleVideoTest();
                        const study = () => __awaiter(this, void 0, void 0, function* () {
                            var _a, _b;
                            const lessonName = (_a = document.querySelector('.j-lesson .j-up')) === null || _a === void 0 ? void 0 : _a.textContent;
                            const currentUnitItem = document.querySelector('.j-unitslist  li.current');
                            const unitName = (_b = currentUnitItem === null || currentUnitItem === void 0 ? void 0 : currentUnitItem.querySelector('.unit-name')) === null || _b === void 0 ? void 0 : _b.textContent;
                            $msg_and_log('info', `正在学习：${lessonName || ''} - ${unitName || ''}`);
                            const isJob = (iconName) => currentUnitItem === null || currentUnitItem === void 0 ? void 0 : currentUnitItem.querySelector(`[class*=${iconName}]`);
                            let hasJob = true;
                            if (isJob('u-icon-video')) {
                                yield (0, study_1.waitForElement)('video, audio');
                                yield watchMedia(this.cfg.playbackRate, this.cfg.volume);
                                $msg_and_log('info', '视频学习完成');
                            }
                            else if (isJob('u-icon-doc')) {
                                yield (0, study_1.waitForElement)('.ux-pdf-reader');
                                yield readPPT(remotePage, this.cfg.readSpeed);
                                $msg_and_log('info', 'PPT完成');
                            }
                            else if (isJob('u-icon-discuss')) {
                                yield (0, study_1.waitForElement)('.j-reply-all');
                                yield discussion(remotePage, this.cfg.discussionStrategy);
                                $msg_and_log('info', '讨论完成');
                            }
                            else if (isJob('u-icon-test')) {
                                const replay = yield (0, study_1.waitForElement)('.j-replay');
                                if ((replay === null || replay === void 0 ? void 0 : replay.style.display) === 'none') {
                                    if (this.cfg.enableChapterTest) {
                                        yield new Promise((resolve) => {
                                            exports.ICourseProject.scripts.work.methods.start('chapter-test', canRun, (worker) => {
                                                console.log('worker', worker);
                                                worker.once('done', resolve);
                                                worker.once('close', resolve);
                                                worker.once('stop', resolve);
                                            });
                                        });
                                        $msg_and_log('info', '测验完成');
                                    }
                                    else {
                                        $msg_and_log('warn', '随堂测验自动答题功能已关闭（上方菜单栏-中国大学MOOC-学习脚本中开启），即将跳过。');
                                    }
                                }
                                else {
                                    $msg_and_log('info', '随堂测验已完成，即将跳过。');
                                }
                            }
                            else if (isJob('u-icon-text')) {
                                const key = 'text-job-reload';
                                if ((yield easy_us_1.$store.getTab(key)) === '1') {
                                    easy_us_1.$store.setTab(key, '0');
                                    $msg_and_log('info', '文档已完成，即将跳过。');
                                }
                                else {
                                    // 需要刷新才能完成富文本文档任务点
                                    easy_us_1.$store.setTab(key, '1');
                                    // 文档无需处理
                                    $msg_and_log('info', '文档无需处理，将在刷新完成后跳过。');
                                    yield core_1.$.sleep(3000);
                                    window.location.reload();
                                    return;
                                }
                            }
                            else {
                                hasJob = false;
                            }
                            yield core_1.$.sleep(3000);
                            // 跳转下一章，然后通过URL变化，调度器会重新执行此 main 函数
                            if (canRun()) {
                                if (hasJob) {
                                    $msg_and_log('info', '准备跳转下一章');
                                }
                                else {
                                    $msg_and_log('warn', '未找到学习内容，或者此章节不支持自动学习！即将跳过本章节');
                                }
                                yield gotoNextJob();
                            }
                        });
                        study();
                        function gotoNextJob() {
                            return __awaiter(this, void 0, void 0, function* () {
                                const list = yield next();
                                for (const item of list) {
                                    const el = typeof item === 'function' ? item() : item;
                                    if (el) {
                                        yield (remotePage === null || remotePage === void 0 ? void 0 : remotePage.click(el));
                                    }
                                }
                                if (list.length === 0) {
                                    easy_us_1.$message.success({ content: '所有章节学习完成！', duration: 0 });
                                    background_1.$console.info('所有章节学习完成！');
                                    common_1.CommonProject.scripts.settings.methods.notificationBySetting('所有章节学习完成！', {
                                        duration: 0,
                                        extraTitle: '中国大学MOOC学习脚本'
                                    });
                                }
                            });
                        }
                        function next() {
                            var _a;
                            return __awaiter(this, void 0, void 0, function* () {
                                const nextEl = (_a = document.querySelector('.unitslist .current')) === null || _a === void 0 ? void 0 : _a.nextElementSibling;
                                // 判断小节
                                if (nextEl) {
                                    return [nextEl.querySelector('.unit-name')];
                                }
                                // 判断章节
                                const getName = (node) => { var _a; return (_a = node === null || node === void 0 ? void 0 : node.textContent) === null || _a === void 0 ? void 0 : _a.replace(/\s/g, ''); };
                                const lessonName = getName(document.querySelector('.j-lesson .j-up'));
                                if (!lessonName) {
                                    throw Error('无法读取章节名!');
                                }
                                const lessonList = Array.from(document.querySelectorAll('.j-lesson .j-list .list'));
                                let nextLesson = undefined;
                                for (const item of lessonList) {
                                    const itemName = getName(item);
                                    if (itemName === lessonName) {
                                        if (item.nextElementSibling) {
                                            nextLesson = item.nextElementSibling;
                                            break;
                                        }
                                    }
                                }
                                if (nextLesson) {
                                    return [
                                        // 点击展开章节列表
                                        document.querySelector('.j-lesson'),
                                        // 点击章节
                                        nextLesson
                                    ];
                                }
                                // 判断单元
                                const chapterName = getName(document.querySelector('.j-chapter .j-up'));
                                if (!chapterName) {
                                    throw Error('无法读取单元名!');
                                }
                                const chapterList = Array.from(document.querySelectorAll('.j-chapter .j-list .list'));
                                let nextChapter = undefined;
                                for (const item of chapterList) {
                                    const itemName = getName(item);
                                    if (itemName === chapterName) {
                                        if (item.nextElementSibling) {
                                            nextChapter = item.nextElementSibling;
                                            break;
                                        }
                                    }
                                }
                                if (nextChapter) {
                                    return [
                                        // 点击展开单元列表
                                        () => document.querySelector('.j-chapter'),
                                        // 点击单元
                                        () => nextChapter,
                                        // 点击展开章节列表
                                        () => document.querySelector('.j-lesson'),
                                        // 点击第一个章节
                                        () => document.querySelectorAll('.j-lesson .j-list .list')[0]
                                    ];
                                }
                                else {
                                    return [];
                                }
                            });
                        }
                    })
                };
            }
        }),
        work: new easy_us_1.Script({
            name: '✍️ 作业考试脚本',
            // 添加版本号是因为只有 notes 会强制更新，其他配置项不会，如果需要修改 runAtHash ，需要更新版本号
            namespace: 'icourse.work-v2',
            matches: [
                ['MOOC作业页面', 'icourse163.org/learn'],
                ['SPOC作业页面', 'icourse163.org/spoc/learn'],
                ['考试页面', 'icourse163.org/mooc/main/newExam']
            ],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '自动答题前请在 “通用-全局设置” 中设置题库配置。',
                        '⚠️禁止同时开多个作业/考试页面。',
                        [
                            '⚠️由于MOOC限制、答题速度和搜题速度将默认调慢',
                            ' 防止出现网络并发，导致无法选上选项的问题。',
                            ' 答题和搜题过慢是正常情况。'
                        ]
                    ]).outerHTML
                },
                runAtHash: {
                    defaultValue: ['/learn/quiz', '/learn/examObject']
                }
            },
            methods() {
                const start = (type, canRun, onWorkerCreated) => __awaiter(this, void 0, void 0, function* () {
                    // 检查是否为软件环境
                    const remotePage = yield background_1.BackgroundProject.scripts.dev.methods.getRemotePlaywrightCurrentPage();
                    // 检查是否为软件环境
                    if (!remotePage) {
                        return app_1.$playwright.showError();
                    }
                    // 等待加载题目
                    yield waitForQuestion();
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    background_1.BackgroundProject.scripts.render.methods.normal();
                    $msg_and_log('info', '开始答题');
                    (0, work_1.commonWork)(this, {
                        workerProvider: (opts) => {
                            const worker = workAndExam(remotePage, type, opts);
                            worker.once('close', () => {
                                clearInterval(interval);
                            });
                            const interval = setInterval(() => {
                                if (canRun() === false) {
                                    $msg_and_log('warn', '检测到页面切换，无法继续答题，将关闭自动答题。');
                                    clearInterval(interval);
                                    worker.emit('close');
                                }
                            }, 1000);
                            return worker;
                        },
                        onWorkerCreated: onWorkerCreated,
                        start_delay_seconds: 3
                    });
                });
                return {
                    main: ({ canRun }) => __awaiter(this, void 0, void 0, function* () {
                        if (location.hash.includes('learn/quizscore')) {
                            easy_us_1.$message.success('当前作业已完成，自动答题关闭。');
                            return;
                        }
                        return start('work', canRun);
                    }),
                    start: start
                };
            },
            // 考试是新开一个界面所以会直接触发
            oncomplete() {
                if ((location.href.includes('/learn/examObject') &&
                    // 考试成绩解析页面
                    !location.href.includes('learn/examObjectScore')) ||
                    // 新版考试界面
                    location.href.includes('/mooc/main/newExam')) {
                    this.methods.start('exam', () => true);
                }
            }
        }),
        passportRedirect: new easy_us_1.Script({
            name: '登录重定向修复',
            matches: [['登录重定向', 'passport/logingate/changeCookie.htm']],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes(['检测到页面重定向到空白页面', '程序将会自动修复']).outerHTML
                }
            },
            hideInPanel: true,
            oncomplete(...args) {
                background_1.BackgroundProject.scripts.render.methods.pin(this);
                easy_us_1.$message.info('检测到中国大学MOOC空白页面，即将重定向修复...');
                setTimeout(() => {
                    location.href = 'https://www.icourse163.org/';
                }, 3000);
            }
        })
    }
});
function waitForQuestion() {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if (document.querySelector('.u-questionItem,[class*=questionBody]')) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });
}
function workAndExam(rp, type, { answererWrappers, redundanceWordsText, upload, stopSecondWhenFinish, answerSeparators }) {
    common_1.CommonProject.scripts.workResults.methods.init({
        questionPositionSyncHandlerType: 'icourse'
    });
    const titleTransform = (titles) => {
        const images = [];
        const text = (0, work_1.removeRedundantWords)(titles
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
            .filter((t) => t.trim() !== '')
            .join(',')
            // /\u200B/g 排除不可见的空格
            .replace(/[\u200A-\u200F]/g, ''), redundanceWordsText.split('\n'));
        return { text, images };
    };
    /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
    const titleText = (titles) => titleTransform(titles).text;
    const work_type = type;
    /** 新建答题器 */
    const worker = new core_1.OCSWorker({
        root: type === 'exam' ? '[class*=questionBody]' : '.u-questionItem',
        elements: {
            title: type === 'exam' ? '[class*=questionInfo]' : '.j-title .j-richTxt',
            options: type === 'exam' ? '[class*=index-module__optionBody]' : '.choices li,.inputArea'
        },
        thread: 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements, _ctx) => titleTransform(elements.title),
            optionsTransform: (elements, ctx) => {
                const optResults = ctx.elements.options.map((o) => (0, work_1.extractTextWithImages)(o));
                return {
                    text: optResults.map((r) => r.text).join('\n'),
                    images: optResults.flatMap((r) => r.images)
                };
            },
            answererWrappers,
            period: 5
        }),
        work: {
            /** 选项文本提供器：替代 innerText，使图片 URL 进入匹配文本 */
            optionText: (o) => (0, work_1.extractTextWithImages)(o).text,
            /** 自定义处理器 */
            handler(type, answer, option) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        if (work_type === 'exam') {
                            const input = option.querySelector('input');
                            if (input && !(input === null || input === void 0 ? void 0 : input.checked)) {
                                return yield networkIdleRequire(rp, () => __awaiter(this, void 0, void 0, function* () {
                                    yield core_1.$.sleep(1000);
                                    return input.click();
                                }));
                            }
                        }
                        const text = option.querySelector('.f-richEditorText');
                        const input = option.querySelector('input');
                        if (input && !(input === null || input === void 0 ? void 0 : input.checked) && text) {
                            yield networkIdleRequire(rp, () => __awaiter(this, void 0, void 0, function* () {
                                yield core_1.$.sleep(1000);
                                yield rp.click(text);
                            }));
                        }
                    }
                    else if (type === 'completion' && answer.trim()) {
                        const textarea = option.querySelector('textarea');
                        const id = ((_a = textarea === null || textarea === void 0 ? void 0 : textarea.getAttribute('id')) === null || _a === void 0 ? void 0 : _a.toString()) || '';
                        if (id && (textarea === null || textarea === void 0 ? void 0 : textarea.value.trim()) !== answer.trim()) {
                            yield networkIdleRequire(rp, () => __awaiter(this, void 0, void 0, function* () {
                                yield core_1.$.sleep(1000);
                                yield rp.click('#' + id);
                                yield rp.fill('#' + id, answer.trim());
                            }));
                        }
                    }
                });
            }
        },
        onElementSearched(elements, root) {
            elements.options.forEach((el) => {
                // 保留对/错图标替换；图片 URL 改由 work.optionText 提取，不再改造 DOM
                const correct = el.querySelector('.u-icon-correct');
                const wrong = el.querySelector('.u-icon-wrong');
                if (correct) {
                    correct.replaceWith('对');
                }
                if (wrong) {
                    wrong.replaceWith('错');
                }
            });
        },
        /** 完成答题后 */
        onResultsUpdate(curr, _, res) {
            var _a;
            common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, titleText));
            if ((_a = curr.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([curr], titleText));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    worker
        .doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug })
        .then((results) => __awaiter(this, void 0, void 0, function* () {
        if (worker.isClose) {
            return;
        }
        if (type === 'chapter-test') {
            $msg_and_log('info', `答题完成，将等待 ${stopSecondWhenFinish} 秒后进行保存或提交。`);
            yield core_1.$.sleep(stopSecondWhenFinish * 1000);
            if (worker.isClose) {
                return;
            }
            // 处理提交
            yield worker.uploadHandler({
                type: upload,
                results,
                callback(finishedRate, uploadable) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const content = `完成率 ${finishedRate.toFixed(2)}% :  ${uploadable ? '3秒后将自动提交' : '3秒后将自动跳过（没保存按钮）'} `;
                        background_1.$console.info(content);
                        easy_us_1.$message.success({ content: content, duration: type === 'chapter-test' ? 10 : 0 });
                        yield core_1.$.sleep(3000);
                        if (worker.isClose) {
                            return;
                        }
                        if (uploadable) {
                            // 先收起面板防止阻挡，元素无法通过移动脚本面板去点击
                            background_1.BackgroundProject.scripts.render.methods.minimize();
                            background_1.BackgroundProject.scripts.render.methods.setPosition(100, 200);
                            const sumbit = document.querySelector('.j-submit');
                            if (sumbit) {
                                yield rp.click(sumbit);
                            }
                            else {
                                $msg_and_log('warn', '没有找到提交按钮，将跳过提交。');
                            }
                        }
                    });
                }
            });
        }
        else {
            easy_us_1.$message.success({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        }
        worker.emit('done');
    }))
        .catch((err) => {
        easy_us_1.$message.error({ content: '答题程序发生错误 : ' + err.message, duration: 0 });
    });
    return worker;
}
function watchMedia(playbackRate, volume) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            // 部分用户视频加载很慢，这里等待一下
            (0, study_1.waitForMedia)()
                .then((video) => {
                video.playbackRate = playbackRate;
                video.volume = volume;
                state.currentMedia = video;
                (0, utils_1.playMedia)(() => video === null || video === void 0 ? void 0 : video.play());
                video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                    if (!(video === null || video === void 0 ? void 0 : video.ended)) {
                        video === null || video === void 0 ? void 0 : video.play();
                    }
                });
                video.onended = () => {
                    resolve();
                };
            })
                .catch(reject);
        });
    });
}
function readPPT(remotePage, readSpeed) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const reader = document.querySelector('.ux-pdf-reader');
        if (reader) {
            const total = parseInt(((_c = (_b = (_a = document
                .querySelector('.ux-h5pdfreader_container_footer_pages_total')) === null || _a === void 0 ? void 0 : _a.childNodes[1]) === null || _b === void 0 ? void 0 : _b.textContent) === null || _c === void 0 ? void 0 : _c.replace(/\s/, '')) || '0');
            const start = parseInt(((_d = document.querySelector('.ux-h5pdfreader_container_footer_pages_in')) === null || _d === void 0 ? void 0 : _d.value) || '1');
            for (let index = start; index < total + 1; index++) {
                const next = document.querySelector('.ux-h5pdfreader_container_footer_pages_next');
                if (next) {
                    yield remotePage.click(next);
                }
                else {
                    $msg_and_log('error', '未找到PPT的下一页按钮！');
                }
                yield core_1.$.sleep(readSpeed * 1000);
            }
        }
    });
}
function discussion(remotePage, discussionStrategy) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        if (discussionStrategy === 'not-reply') {
            return $msg_and_log('warn', '讨论自动回复功能已关闭（上方菜单栏-中国大学MOOC-学习脚本中开启）。');
        }
        let res = '';
        if (discussionStrategy === 'max-show-up') {
            const list = Array.from(document.querySelectorAll('.j-reply-all .f-pr .j-content'));
            const mapping = new Map();
            for (const item of list) {
                mapping.set(item.textContent, (mapping.get(item.textContent) || 0) + 1);
            }
            const content = (_b = (_a = [...mapping.entries()].sort((a, b) => b[1] - a[1])) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b[0];
            if (!content) {
                $msg_and_log('error', '读取出现最多评论失败！');
            }
            res = content;
        }
        else if (discussionStrategy === 'max-fav') {
            const list = Array.from(document.querySelectorAll('.j-reply-all .f-pr'));
            let max = 0;
            let maxEl = undefined;
            for (const item of list) {
                const num = parseInt(((_c = item.querySelector('.bar .num')) === null || _c === void 0 ? void 0 : _c.textContent) || '0');
                if (num > max) {
                    max = num;
                    maxEl = item;
                }
            }
            const content = ((_d = maxEl === null || maxEl === void 0 ? void 0 : maxEl.querySelector('.j-content')) === null || _d === void 0 ? void 0 : _d.textContent) || '';
            if (!content) {
                $msg_and_log('error', '读取最多点赞评论失败！');
            }
            res = content;
        }
        else if (discussionStrategy === 'use-newest') {
            const content = ((_e = document.querySelector('.j-reply-all .f-pr .first .j-content')) === null || _e === void 0 ? void 0 : _e.textContent) || '';
            if (!content) {
                $msg_and_log('error', '读取最新评论失败！');
            }
            res = content;
        }
        const p = document.querySelector('.j-reply-add div.ql-editor.ql-blank p');
        if (p) {
            p.innerText = res;
            yield core_1.$.sleep(1000);
            const submit = document.querySelector('.j-reply-add .editbtn');
            if (submit) {
                yield remotePage.click(submit);
                easy_us_1.$message.info('提交回复成功！');
            }
            else {
                $msg_and_log('error', '获取提交按钮失败！');
            }
            yield core_1.$.sleep(2000);
        }
        else {
            $msg_and_log('error', '获取评论输入框失败！');
        }
    });
}
/**
 * 执行回调，并且检测是否触发并发限制
 * 如果限制，等待一段时间后重新执行回调
 */
function networkIdleRequire(rp, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        yield cb();
        // ux-modal  ux-modal-fadeIn
        const modal = yield (0, study_1.waitFor)(() => document.querySelector('.ux-modal_content_content'), {
            check_period_ms: 200,
            timeout_seconds: 1
        });
        if (modal) {
            const msg = easy_us_1.$message.warn('答题速度过快导致并发限制、3秒后再继续答题。');
            yield rp.click('.ux-modal-btn');
            yield core_1.$.sleep(3000);
            yield cb();
            msg === null || msg === void 0 ? void 0 : msg.remove();
        }
    });
}
