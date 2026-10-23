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
exports.ZJYProject = void 0;
const core_1 = require("@ocsjs/core");
const easy_us_1 = require("easy-us");
const configs_1 = require("../utils/configs");
const study_1 = require("../utils/study");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const background_1 = require("./background");
const common_1 = require("./common");
const work_1 = require("../utils/work");
const state = {
    studying: false,
    studyingId: '',
    media: null
};
const work_pages = [
    // 暂时不知道为什么资源库作业有两个不一样的链接
    ['资源库keep作业页面', 'study/spockeepTest'],
    ['资源库job作业页面', 'study/spocjobTest'],
    ['资源库考试', 'study/spoctest'],
    ['课堂测试作业界面', 'study/courseteaching/test/homeWork'],
    ['作业页面', 'icve-study/coursePreview/jobTes'],
    ['考试页面', 'icve-study/coursePreview/test'],
    ['考试页面', 'icve-study/test'],
    ['资源库测验页面', 'icve-study/coursePreview/keepTest']
];
const isWork = () => {
    return (window.location.href.includes('icve-study/coursePreview/jobTes') ||
        window.location.href.includes('icve-study/coursePreview/keepTest') ||
        window.location.href.includes('study/spockeepTest') ||
        window.location.href.includes('study/spocjobTest') ||
        window.location.href.includes('study/courseteaching/test/homeWork'));
};
const isExam = () => {
    return (window.location.href.includes('icve-study/coursePreview/test') ||
        window.location.href.includes('icve-study/test') ||
        window.location.href.includes('study/spoctest'));
};
/**
 * 职教云网课
 *
 * 因为存在子 iframe 并且 ppt 跨域的情况
 * 所以采用新建小窗口的形式，通过子 window 以及 opener 的形式进行互相回调调用
 * 所以核心逻辑代码可能会比较绕。
 *
 * 为什么不在学习页面写脚本，而是 课程学习 和 学习页面 两个脚本进行交互运行？
 * 因为学习页面无法获取学习进度，这样可能导致已学课程重复学习。
 *
 */
exports.ZJYProject = easy_us_1.Project.create({
    name: '职教云',
    domains: ['icve.com.cn', 'zjy2.icve.com.cn', 'zyk.icve.com.cn'],
    scripts: {
        guide: new easy_us_1.Script({
            name: '🖥️ 使用提示',
            matches: [
                ['学习页面', 'zjy2.icve.com.cn/study'],
                ['资源库', 'zyk.icve.com.cn/icve-study/']
            ],
            namespace: 'zjy.study.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['登录网课平台', '点击任意章节进入学习', '等待脚本自动运行']).outerHTML
                }
            }
        }),
        v2: new easy_us_1.Script({
            name: '旧版切换器',
            matches: [['新版智慧职教', 'zjy2.icve.com.cn/study/v2/']],
            hideInPanel: true,
            oncomplete() {
                utils_1.$msg.info('脚本只支持旧版职教云，即将跳转到旧版职教云页面...');
                easy_us_1.$modal.alert({
                    title: '提示',
                    content: '脚本只支持旧版职教云，即将跳转到<b>旧版</b>职教云页面...',
                    maskCloseable: false
                });
                setTimeout(() => {
                    location.href = '/study/index';
                }, 5000);
            }
        }),
        dispatcher: new easy_us_1.Script({
            name: '调度器',
            matches: [
                ['学习页面', 'zjy2.icve.com.cn/study'],
                ['资源库', 'zyk.icve.com.cn/icve-study/'],
                /**
                 * 这个页面需要手动选择时间查找并进入，课程里面无连串课程查找，只能在当前页面整理
                 */
                ['内容资源页面', 'zjy2.icve.com.cn/study/studentFast/classroomNow'],
                ['在线课堂学习页面', 'zjy2.icve.com.cn/study/studentFast/courseware'],
                ['课堂作业测试界面', 'zjy2.icve.com.cn/study/courseteaching/test/homeWork']
            ],
            hideInPanel: true,
            methods() {
                return {
                    dispatch: () => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c;
                        if (['zjy2.icve.com.cn/study/studentFast/classroomNow'].some((i) => window.location.href.includes(i))) {
                            /**
                             * 先在在线课堂内容获取课程数据，然后用户进入课程后看完视频读取数据进行下一章
                             */
                            yield (0, study_1.waitForElement)('.classroom_activities .active_list');
                            const courseData = getCourseDataInClassroomNowPage();
                            console.log(courseData);
                            // @ts-ignore
                            const courseId = ((_c = (_b = (_a = document.querySelector('.teacherLayout')) === null || _a === void 0 ? void 0 : _a.__vue__) === null || _b === void 0 ? void 0 : _b.courseInfo) === null || _c === void 0 ? void 0 : _c.id) || '';
                            if (!courseData || !courseId) {
                                return;
                            }
                            exports.ZJYProject.scripts.study.cfg.currentCourseId = courseId;
                            exports.ZJYProject.scripts.study.cfg.courseList = courseData;
                            easy_us_1.$message.success('课程数据获取成功，请点击课程章节开始学习');
                        }
                        else if ([
                            'zyk.icve.com.cn/icve-study/coursePreview/courseware',
                            'zjy2.icve.com.cn/study/coursePreview/spoccourseIndex/courseware',
                            'zjy2.icve.com.cn/study/studentFast/courseware'
                        ].some((i) => window.location.href.includes(i))) {
                            const isClassroomNowStudy = location.href.includes('zjy2.icve.com.cn/study/studentFast/courseware');
                            exports.ZJYProject.scripts.study.methods.main(isClassroomNowStudy ? 'classroomNow' : 'normal');
                        }
                        else if (work_pages.map(([_, p]) => p).some((i) => window.location.href.includes(i))) {
                            exports.ZJYProject.scripts.work.methods.main();
                        }
                    })
                };
            },
            /**
             *
             * 新版职教云采用VUE技术路由，所以这里需要使用 onhistorychange 监听路由变化，然后脚本中自行判断相应的路由执行情况
             */
            onhistorychange(type) {
                if (type === 'push') {
                    this.methods.dispatch();
                }
            },
            oncomplete() {
                this.methods.dispatch();
            }
        }),
        study: new easy_us_1.Script({
            matches: [
                ['学习页面', 'zjy2.icve.com.cn/study/coursePreview/spoccourseIndex/courseware'],
                /** classroomNow */
                ['在线课堂学习页面', 'zjy2.icve.com.cn/studentFast/courseware'],
                ['资源库学习页面', 'zyk.icve.com.cn/icve-study/coursePreview/courseware']
            ],
            name: '✍️ 课程学习',
            namespace: 'zjy.study.main',
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        ['如果脚本卡死或者您不想学习，', '可以点击其他任意章节继续进行学习。'],
                        '提示：职教云无法使用倍速。'
                    ]).outerHTML
                },
                volume: configs_1.volume,
                playbackRate: {
                    label: '视频倍速',
                    tag: 'select',
                    options: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 6, 8].map((rate) => [
                        rate.toString(),
                        rate + ' x'
                    ]),
                    defaultValue: '1'
                },
                pptReadPeriod: {
                    label: 'PPT 阅读每页停留时间（秒）',
                    defaultValue: 1,
                    attrs: { type: 'number', min: 1, step: 1, max: 10 }
                },
                currentCourseId: {
                    defaultValue: ''
                },
                courseList: {
                    defaultValue: []
                }
            },
            methods() {
                return {
                    main: (type) => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const id = new URL(window.location.href).searchParams.get(type === 'classroomNow' ? 'activityId' : 'id');
                        if (!id) {
                            return;
                        }
                        if (state.studying && id === state.studyingId) {
                            return;
                        }
                        state.studyingId = id;
                        state.studying = true;
                        this.onConfigChange('volume', (val) => {
                            if (state.media) {
                                state.media.volume = parseFloat(val.toString());
                            }
                        });
                        this.onConfigChange('playbackRate', (val) => {
                            if (state.media) {
                                state.media.playbackRate = parseFloat(val.toString());
                            }
                        });
                        yield waitForLoad();
                        setTimeout(() => {
                            var _a, _b;
                            // 删除是否继续学习的弹窗
                            (_a = (0, easy_us_1.$el)('.el-message-box__wrapper')) === null || _a === void 0 ? void 0 : _a.remove();
                            (_b = (0, easy_us_1.$el)('.v-modal')) === null || _b === void 0 ? void 0 : _b.remove();
                        }, 3000);
                        yield waitForLoad();
                        // 加载课程数据
                        if (type === 'normal') {
                            const courseId = getUniqueCourseId();
                            if (!courseId) {
                                easy_us_1.$message.error({ content: '获取课程数据失败，请手动刷新页面' });
                                return;
                            }
                            const not_same_class = !exports.ZJYProject.scripts.study.cfg.currentCourseId ||
                                exports.ZJYProject.scripts.study.cfg.currentCourseId !== courseId;
                            // 如果课程不一致，或者没有课程数据，则重新获取课程数据
                            if (not_same_class ||
                                !exports.ZJYProject.scripts.study.cfg.courseList ||
                                exports.ZJYProject.scripts.study.cfg.courseList.length === 0) {
                                const courseData = yield getCourseData();
                                if (!courseData) {
                                    return;
                                }
                                exports.ZJYProject.scripts.study.cfg.currentCourseId = courseId;
                                exports.ZJYProject.scripts.study.cfg.courseList = courseData;
                            }
                        }
                        const courseInfo = exports.ZJYProject.scripts.study.cfg.courseList.find((i) => i.id === id);
                        if (!courseInfo) {
                            const btn = (0, easy_us_1.h)('button', { className: 'base-style-button' }, '修复数据');
                            btn.onclick = () => __awaiter(this, void 0, void 0, function* () {
                                const courseId = getUniqueCourseId();
                                if (!courseId) {
                                    easy_us_1.$message.error({ content: '获取课程数据失败！' });
                                    return;
                                }
                                const courseData = yield getCourseData();
                                if (!courseData) {
                                    return;
                                }
                                exports.ZJYProject.scripts.study.cfg.currentCourseId = courseId;
                                exports.ZJYProject.scripts.study.cfg.courseList = courseData;
                                easy_us_1.$modal.simple({
                                    title: '提示',
                                    content: '数据已修复完毕，请刷新页面重新尝试运行。'
                                });
                            });
                            const err = '获取课程信息失败，请手动刷新页面，或者尝试修复数据：';
                            easy_us_1.$message.error({ content: (0, easy_us_1.h)('span', [err, btn]), duration: 0 });
                            background_1.$console.error(err);
                            return;
                        }
                        /**
                         * courseType 在类型为文件夹+附件形式（附件为视频）时，显示混乱类型比如：courseType: 知识点讲解
                         * 此时从页面获取的 curType 反而是正确的 video 类型
                         */
                        const vue = getVueBindElement();
                        const courseType = vue.curType === 'video' ? 'video' : (courseInfo === null || courseInfo === void 0 ? void 0 : courseInfo.fileType) || '';
                        const started_url = window.location.href;
                        let msg = '开始学习：' + courseType + '-' + courseInfo.name;
                        easy_us_1.$message.success(msg);
                        background_1.$console.info(msg);
                        if (['ppt', 'doc', 'pptx', 'docx', 'pdf', 'txt', 'ppt文档', 'xls', 'xlsx'].some((i) => courseType === i)) {
                            yield watchFile(this.cfg.pptReadPeriod);
                        }
                        else if (['video', 'audio', 'mp4', 'mp3', 'flv', 'wav', '视频'].some((i) => courseType === i)) {
                            const text = ((_a = (0, easy_us_1.$el)('.guide')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
                            msg = `任务点 ${courseInfo.name}，不支持播放。`;
                            if (text.includes('很抱歉，您的浏览器不支持播放此类文件') || text.includes('此视频暂无法播放')) {
                                msg = `任务点 ${courseInfo.name}，不支持播放。`;
                                easy_us_1.$message.error(msg);
                                background_1.$console.error(msg);
                            }
                            else {
                                yield watchMedia();
                            }
                        }
                        else if (['png', 'jpg', '图片'].some((i) => courseType === i)) {
                            msg = `已查看图片任务点 ${courseInfo.name}，即将跳过。`;
                            easy_us_1.$message.info(msg);
                            background_1.$console.info(msg);
                        }
                        else {
                            msg = `未知的任务点 ${courseInfo.name}，类型 ${courseType}，请跟作者进行反馈。`;
                            easy_us_1.$message.error(msg);
                            background_1.$console.error(msg);
                        }
                        if (started_url === window.location.href) {
                            msg = '任务点结束，五秒后下一章';
                            easy_us_1.$message.warn('如果职教云一直卡在显示：“资源类型无法学习，请核对数据！” 请手动切换下一章。');
                            easy_us_1.$message.info(msg);
                            background_1.$console.info(msg);
                            yield core_1.$.sleep(5000);
                            yield next(type);
                        }
                    })
                };
            }
        }),
        work: new easy_us_1.Script({
            matches: work_pages,
            name: '✍️ 作业考试脚本',
            namespace: 'zjy.work.main',
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '自动答题前请在 “通用-全局设置” 中设置题库配置。',
                        '可以搭配 “通用-在线搜题” 一起使用。',
                        '请手动进入作业考试页面才能使用自动答题。'
                    ]).outerHTML
                }
            },
            methods() {
                return {
                    main: () => __awaiter(this, void 0, void 0, function* () {
                        if (isWork() || isExam()) {
                            yield waitForQuestions();
                            (0, work_1.commonWork)(this, {
                                workerProvider: (opt) => workOrExam(isWork() ? 'work' : 'exam', opt)
                            });
                        }
                    })
                };
            }
        })
    }
});
function watchMedia() {
    return __awaiter(this, void 0, void 0, function* () {
        const media = yield (0, study_1.waitForMedia)();
        media.volume = parseFloat(exports.ZJYProject.scripts.study.cfg.volume.toString());
        media.playbackRate = parseFloat(exports.ZJYProject.scripts.study.cfg.playbackRate.toString());
        state.media = media;
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
                        media.volume = parseFloat(exports.ZJYProject.scripts.study.cfg.volume.toString());
                        media.playbackRate = parseFloat(exports.ZJYProject.scripts.study.cfg.playbackRate.toString());
                    }
                }, 1000);
            });
        });
    });
}
function watchFile(pptReadPeriod) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const vue = getPPTVueBindElement();
        if (!vue) {
            return;
        }
        while (true) {
            const [current, total] = ((_b = (_a = document
                .querySelector('.preview .page')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim().replace('上一页', '').replace('下一页', '').split('/').map((i) => parseInt(i.trim()))) || [];
            if (!current || !total) {
                break;
            }
            if (current >= total) {
                break;
            }
            // 旧版PPT任务，新版使用 skip
            try {
                vue.next && vue.next();
            }
            catch (_c) { }
            try {
                vue.skip && vue.skip();
            }
            catch (_d) { }
            yield core_1.$.sleep(pptReadPeriod * 1000);
        }
    });
}
// 资源库和新职教云的数据都一样的
// 资源库的课程可直接获取
// 新职教云的课程数据需要每个列表展开才能读取到
function getUniqueCourseId() {
    var _a, _b, _c, _d;
    // @ts-ignore
    return ((_d = (_c = (_b = (_a = document.querySelector('.coursePreviewIndex')) === null || _a === void 0 ? void 0 : _a.__vue__) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.courseId) || '';
}
function isZyk() {
    return location.href.includes('zyk.icve.com.cn');
}
function getVueBindElement() {
    var _a, _b;
    return ((_a = (0, easy_us_1.$el)('.guide')) === null || _a === void 0 ? void 0 : _a.__vue__) || ((_b = (0, easy_us_1.$el)('.teach')) === null || _b === void 0 ? void 0 : _b.__vue__);
}
function getPPTVueBindElement() {
    /**
     * 2025/11月新PPT，使用 FilePreview 获取
     */
    var _a, _b, _c;
    return ((_a = (0, easy_us_1.$el)('.FilePreview')) === null || _a === void 0 ? void 0 : _a.__vue__) || ((_b = (0, easy_us_1.$el)('.guide')) === null || _b === void 0 ? void 0 : _b.__vue__) || ((_c = (0, easy_us_1.$el)('.teach')) === null || _c === void 0 ? void 0 : _c.__vue__);
}
function next(type) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        /**
         * activityId 属于老师在线课堂 classroomNow 页面跳转参数
         */
        const field = type === 'classroomNow' ? 'activityId' : 'id';
        const id = new URL(window.location.href).searchParams.get(field);
        let nextObject;
        const data = exports.ZJYProject.scripts.study.cfg.courseList;
        const start_index = data.findIndex((i) => i.id === id);
        for (let index = start_index + 1; index < data.length; index++) {
            const item = data[index];
            // 跳过讨论
            if (['测验', '讨论'].some((i) => item.fileType === i)) {
                continue;
            }
            nextObject = item;
            break;
        }
        if (id && nextObject) {
            // .teach 是新职教云思维导图任务点页面的VUE数据绑定点，无法通过 .guide 获取
            const vue = getVueBindElement();
            // 如果有 nextObj 数据则代表可以点击下一节按钮，否则需要根据全局数据去进行查找跳转
            // 使用自带的跳转功能更加兼容，防止数据错乱（使用url跳转学习记录可能会不一致）
            // 这里根据判断ID是否相同，否则强制跳过讨论或者测验
            if (((_a = vue === null || vue === void 0 ? void 0 : vue.nextObj) === null || _a === void 0 ? void 0 : _a.id) && nextObject.id === vue.nextObj.id) {
                vue.preNext(vue.nextObj);
                return;
            }
            yield core_1.$.sleep(3000);
            const url = new URL(window.location.href);
            if (nextObject.courseDesignId) {
                url.searchParams.set('courseDesignId', nextObject.courseDesignId);
            }
            url.searchParams.set(field, nextObject.id);
            window.location.replace(url.href);
        }
        else {
            easy_us_1.$message.success({
                duration: 0,
                content: '全部任务已完成。'
            });
            background_1.$console.info('全部任务已完成。');
            common_1.CommonProject.scripts.settings.methods.notificationBySetting('全部任务点已完成！', {
                duration: 0,
                extraTitle: '职教云学习脚本'
            });
            state.studying = false;
        }
    });
}
function getCourseDataInClassroomNowPage() {
    var _a, _b, _c;
    // @ts-ignore
    const list = ((_b = (_a = document.querySelector('.classroom_activities')) === null || _a === void 0 ? void 0 : _a.__vue__) === null || _b === void 0 ? void 0 : _b.activeList) || [];
    const data = [];
    const temp = JSON.parse(JSON.stringify(list));
    while (temp.length > 0) {
        const item = temp.shift();
        if (((_c = item === null || item === void 0 ? void 0 : item.children) === null || _c === void 0 ? void 0 : _c.length) > 0) {
            temp.unshift(...item.children);
        }
        else {
            data.push({
                name: item.title,
                id: item.activityId,
                fileType: item.fileType,
                courseDesignId: item.courseDesignId,
                levelName: item.levelName || ''
            });
        }
    }
    return data;
}
function getCourseData() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const getDataList = () => {
            var _a, _b, _c;
            // @ts-ignore
            const list = ((_b = (_a = document.querySelector('.coursePreviewIndex')) === null || _a === void 0 ? void 0 : _a.__vue__) === null || _b === void 0 ? void 0 : _b.list) || [];
            const data = [];
            const temp = JSON.parse(JSON.stringify(list));
            while (temp.length > 0) {
                const item = temp.shift();
                if (((_c = item === null || item === void 0 ? void 0 : item.children) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                    temp.unshift(...item.children);
                }
                else {
                    data.push({
                        name: item.name,
                        id: item.id,
                        fileType: item.fileType,
                        levelName: item.levelName || '',
                        courseDesignId: item.courseDesignId || ''
                    });
                }
            }
            return data;
        };
        // 资源库的课程可直接获取
        // 新职教云的课程数据需要每个列表展开才能读取到
        if (isZyk() === false) {
            const progress = (0, easy_us_1.h)('div');
            const modal_content = (0, easy_us_1.h)('div', [
                (0, easy_us_1.h)('div', { className: 'notes card' }, [
                    easy_us_1.$ui.notes([
                        '职教云由于大章节之间无自动下一节按钮，需要在课程开始前',
                        '由程序读取全部章节数据，这样才能自动运行',
                        '数据只需读取一遍即可，后续无需重新读取'
                    ])
                ]),
                progress
            ]);
            let force_pause = false;
            const modal = easy_us_1.$modal.confirm({
                content: modal_content,
                maskCloseable: false,
                title: '正在获取课程数据中，请勿操作...',
                confirmButton: null,
                cancelButtonText: '强制暂停',
                onCancel() {
                    force_pause = true;
                }
            });
            const kejianListEl = document.querySelector('.kejianList');
            if (!kejianListEl) {
                easy_us_1.$message.error({ content: '获取课程数据失败，请手动刷新页面' });
                return undefined;
            }
            if (kejianListEl.style.display === 'none') {
                (_a = Array.from(document.querySelectorAll('.courseBtn div.customBtn'))
                    .find((el) => { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes('课件目录'); })) === null || _a === void 0 ? void 0 : _a.click();
                yield core_1.$.sleep(1000);
            }
            // 持续递归获取课程数据，直到获取完成为止
            const folders = [];
            while (true) {
                const itemsElList = Array.from(document.querySelectorAll('.items'));
                const unsaved = itemsElList.find((item) => folders.includes(item) === false);
                if (!unsaved) {
                    break;
                }
                const list = getDataList();
                // 不是文件夹不点
                const course_info = list.find((item) => {
                    var _a;
                    // 子章节中间有空格拼接， 大章节没有
                    return `${item.levelName || ''}${item.name}`.replace(/\s/g, '') ===
                        (((_a = unsaved.textContent) === null || _a === void 0 ? void 0 : _a.trim().replace(/\s/g, '')) || '');
                });
                if (!course_info || ['父节点', '子节点'].includes(course_info.fileType) === false) {
                    folders.push(unsaved);
                    continue;
                }
                if (force_pause) {
                    const err = '已强制暂停，请手动刷新页面后才能重新运行';
                    easy_us_1.$message.error({ content: err, duration: 0 });
                    easy_us_1.$modal.alert({ content: err });
                    return undefined;
                }
                folders.push(unsaved);
                if (modal) {
                    // iChild 为资源库类
                    // fIteml 为职教云类
                    progress.innerHTML = '<br><b>当前已获取 ' + document.querySelectorAll('.fIteml,.iChild').length + ' 个小节</b>';
                }
                unsaved.click();
                yield core_1.$.sleep(1000);
            }
            modal === null || modal === void 0 ? void 0 : modal.remove();
        }
        return getDataList();
    });
}
function waitForLoad() {
    return (0, study_1.waitForElement)(() => getVueBindElement());
}
/**
 * 等待试卷作业加载
 */
function waitForQuestions() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, study_1.waitForElement)([
            // 一般选择器
            '.subjectList',
            // 课堂作业（study/courseteaching/test/homeWork）的特殊选择器
            '.subjectListTest'
        ].join(','));
    });
}
function workOrExam(type, { answererWrappers, period, thread, answerSeparators }) {
    easy_us_1.$message.info({ content: '开始作业' });
    common_1.CommonProject.scripts.workResults.methods.init({
        questionPositionSyncHandlerType: 'zjy'
    });
    const titleTransform = (titles) => {
        return titles
            .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .map((t) => t === null || t === void 0 ? void 0 : t.innerText)
            .join(',');
    };
    const worker = new core_1.OCSWorker({
        root: '.subjectDet',
        elements: {
            title: type === 'work' ? 'h2,h3,h4,h5,h6' : '.titleTest span:not(.xvhao)',
            options: '.optionList div , .tkInput .el-input, .tkInput .el-textarea'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements, _ctx) => titleTransform(elements.title),
            answererWrappers,
            period
        }),
        work: {
            type(ctx) {
                const options = ctx.elements.options;
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
                        : options.some((o) => o.querySelector('[type="text"]')) || options.some((o) => o.querySelector('textarea'))
                            ? 'completion'
                            : undefined;
            },
            /** 自定义处理器 */
            handler(type, answer, option, ctx) {
                var _a, _b;
                if (type === 'judgement' || type === 'single' || type === 'multiple') {
                    // 这里只用判断多选题是否选中，如果选中就不用再点击了，单选题是 radio，所以不用判断。
                    if (((_a = option.querySelector('input')) === null || _a === void 0 ? void 0 : _a.checked) !== true) {
                        (_b = option.querySelector('label')) === null || _b === void 0 ? void 0 : _b.click();
                    }
                }
                else if (type === 'completion' && answer.trim()) {
                    const text = option.querySelector('input[type="text"]');
                    const textarea = option.querySelector('textarea');
                    if (text) {
                        text.value = answer;
                        text.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    else if (textarea) {
                        textarea.value = answer;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }
        },
        /** 完成答题后 */
        onResultsUpdate(curr, _, res) {
            var _a;
            common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, titleTransform));
            if ((_a = curr.result) === null || _a === void 0 ? void 0 : _a.finish) {
                background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([curr], titleTransform));
            }
            common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
        }
    });
    worker
        .doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug })
        .then(() => {
        easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
        worker.emit('done');
    })
        .catch((err) => {
        easy_us_1.$message.error({ content: `作业/考试失败: ${err}`, duration: 0 });
    });
    return worker;
}
