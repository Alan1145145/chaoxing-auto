"use strict";
/** global Ext videojs getTeacherAjax jobs */
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
exports.fixedVideoProgress = exports.study = exports.CXProject = void 0;
const core_1 = require("@ocsjs/core");
const font_decrypt_1 = require("../utils/font-decrypt");
const easy_us_1 = require("easy-us");
const common_1 = require("./common");
const configs_1 = require("../utils/configs");
const work_1 = require("../utils/work");
const background_1 = require("./background");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const study_1 = require("../utils/study");
/**
 * 超星 font-cxsecret 解密用的参考特征表（FRB2 位打包格式，wght 350/400 字重特征）。
 * 由官方 Source Han Sans Normal 字重离线生成（生成脚本见 .codebuddy/font_analysis/），
 * 与平台加密方式无关，无需随超星改字体而更新。
 */
const CX_SECRET_REF_TABLE_URL = 'https://cdn.ocsjs.com/resources/font/font_ref_cx.bin';
const HIGHT_PLAYBACK_RATE_WARNS = [
    '⚠️高倍速、夜间、白天大量运行 等情况\n可能导致学习记录清空/回退',
    '⚠️超星后台可以看到学习时长，请谨慎设置',
    '⚠️如已清空/回退，请降低倍速至1-2倍'
];
// @ts-ignore
let top = globalThis.top;
try {
    // @ts-ignore 任务点
    top.jobs = top.jobs || [];
    // @ts-ignore 当前视频
    top.currentMedia = top.currentMedia || undefined;
    // 加 try 是因为跨域面板无法操作
}
catch (_a) { }
const state = {
    study: {
        videojs: Object.create({}),
        hacked: false,
        answererWrapperUnsetMessage: undefined,
        playbackRateWarningListenerId: 0
    }
};
exports.CXProject = easy_us_1.Project.create({
    name: '超星学习通',
    domains: [
        'chaoxing.com',
        'edu.cn',
        'org.cn',
        // 学银在线
        'xueyinonline.com',
        /** 其他域名 */
        'hnsyu.net',
        'qutjxjy.cn',
        'ynny.cn',
        'hnvist.cn',
        'fjlecb.cn',
        'gdhkmooc.com',
        'cugbonline.cn',
        'zjelib.cn',
        'cqrspx.cn',
        'neauce.com',
        'zhihui-yun.com',
        'cqie.cn',
        'ccqmxx.com',
        'jxgmxy.com',
        'jnzyjsxy.cn',
        'smjyxy.cn',
        // 超星学习通PPT，2025下半年更新的PTT图书新域名
        'sslibrary.com',
        // 26年新增官方域名
        'xuexi365.com'
    ],
    scripts: {
        /**
         * 创建超星独立脚本防止污染其他脚本环境
         */
        env: new easy_us_1.Script({
            name: '环境准备脚本',
            matches: [['所有页面', /.*/]],
            hideInPanel: true,
            onstart() {
                /**
                 * 于 4.9.20 后更新，出现顶层套壳页面跨域 :
                 * top : zjelib.cn <body>
                 * iframe : mooc1.xxx.zjelib.cn/.../mycourse/studentstudy/...  <iframe src=....>
                 * 导致top指向zjelib跨域无法访问，所以这里尝试寻找真正的top窗口对象，只有域名中包含 /mycourse/studentstudy 才是可操作的 top
                 */
                try {
                    let _self = self;
                    let _try_count = 10;
                    while (_self.parent !== undefined && _try_count > 0) {
                        if (_self.location.href.includes('/mycourse/studentstudy')) {
                            top = _self;
                            console.log('[ocsjs] top change to ' + top.location.href);
                            break;
                        }
                        else {
                            _try_count--;
                            // @ts-ignore
                            _self = _self.parent;
                        }
                    }
                }
                catch (e) {
                    console.warn('[ocsjs] fail of find top');
                    console.warn(e);
                    // @ts-ignore
                    top = globalThis.top;
                }
            }
        }),
        guide: new easy_us_1.Script({
            name: '💡 使用提示',
            matches: [
                ['首页', 'https://www.chaoxing.com'],
                ['旧版个人首页', 'chaoxing.com/space/index'],
                ['新版个人首页', 'chaoxing.com/base'],
                ['学习页面', 'chaoxing.com/mycourse'],
                ['新版学习页面', 'chaoxing.com/mooc2-ans/mycourse']
            ],
            namespace: 'cx.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['登录网课平台', '进入任意视频、作业/考试界面', '等待脚本自动运行']).outerHTML
                }
            },
            oncomplete() {
                if (['mycourse/studentstudy'].some((path) => location.href.includes(path))) {
                    easy_us_1.$message.success('已进入学习页面，请等待自动运行...');
                    return;
                }
                if (self !== top)
                    return;
                easy_us_1.$message.info('请手动进入视频、作业、考试页面，脚本会自动运行。');
            },
            onrender({ panel }) {
                // 仅在油猴环境中显示设置跳转按钮（桌面软件等环境的脚本设置在其他平台/界面中显示）
                if (easy_us_1.$gm.isInGMContext()) {
                    /** 跳转到指定脚本面板 */
                    const gotoPanel = (scriptKey) => {
                        const target = exports.CXProject.scripts[scriptKey];
                        // projectName 仅在面板渲染过时才被框架赋值，首次跳转需要手动补齐，
                        // 否则 pin 会退化为按 namespace 匹配，可能选中到被隐藏的脚本面板
                        target.projectName = exports.CXProject.name;
                        background_1.BackgroundProject.scripts.render.methods.pin(target);
                    };
                    panel.body.replaceChildren((0, easy_us_1.h)('hr'), easy_us_1.$ui.button('👉 前往学习设置', {}, (btn) => {
                        btn.style.marginRight = '12px';
                        btn.onclick = () => gotoPanel('study');
                    }), easy_us_1.$ui.button('👉 前往作业设置', {}, (btn) => {
                        btn.onclick = () => gotoPanel('work');
                    }));
                }
            }
        }),
        study: new easy_us_1.Script({
            name: '🖥️ 课程学习',
            namespace: 'cx.new.study',
            matches: [
                ['任务点页面', '/knowledge/cards'],
                ['阅读任务点', '/readsvr/book/mooc']
                // 旧版浏览器好像不能识别二级 iframe ， 所以不能使用 'work/doHomeWorkNew' 以及其他二级 iframe 来触发路由
            ],
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        ['任务点不是顺序执行，如果某一个任务没有动', '请查看是否有其他任务正在学习，耐心等待即可。'],
                        '闯关模式请注意题库如果没完成，需要自己完成才能解锁章节。',
                        '请勿凌晨刷课，部分学校课程可能会清空进度。',
                        ['⚠️目前超星倍速风控严重，如果高倍速', '被平台清空进度，请调到1-2倍速学习！']
                    ]).outerHTML
                },
                playbackRate: Object.assign(Object.assign({}, configs_1.playbackRate), { attrs: { title: HIGHT_PLAYBACK_RATE_WARNS.join('\n') } }),
                volume: configs_1.volume,
                videoQuizStrategy: {
                    label: '视频内题目',
                    tag: 'select',
                    options: [
                        ['random', '随机答题'],
                        ['ignore', '忽略']
                    ],
                    attrs: {
                        title: '视频有时在学习过程中会弹出题目，这个好像并不计算在分数内，所以可以忽略，视频可以正常观看，这里提供几个方法处理题目'
                    },
                    defaultValue: 'random'
                },
                mode: {
                    label: '跳转模式',
                    tag: 'select',
                    options: [
                        ['next', '完成后跳转下一节', '完成小节后，自动点击下一节按钮'],
                        ['job', '完成后跳转未完成任务点', '如果未找到任务点，则会直接结束脚本运行，目前处于试验阶段。'],
                        ['manually', '完成后暂停，等待手动跳转', '适用于自己手动运行']
                    ],
                    defaultValue: 'next'
                },
                restudy: {
                    label: '复习模式',
                    attrs: { title: '已经完成的视频继续学习', type: 'checkbox' },
                    defaultValue: false
                },
                enables: Object.assign(Object.assign({}, configs_1.dropdownStyle), { label: '高级设置', attrs: { type: 'checkbox' }, defaultValue: false }),
                autoJumpToUnFinishJob: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '自动前往首个任务点',
                    attrs: {
                        type: 'checkbox',
                        title: '进入学习界面后自动前往未完成的任务点，如果关闭则从当前任务点往下学习 （积分课、智慧课程等课程 建议关闭）'
                    },
                    defaultValue: true
                },
                forceLearn: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '强制学习',
                    attrs: {
                        title: '视频一般分为：非任务点、任务点、和已完成任务点，当遇到“非任务点”时需要开启此选项才会进行学习',
                        type: 'checkbox'
                    },
                    defaultValue: false
                },
                backToFirstWhenFinish: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '完成全部后重新学习',
                    attrs: {
                        type: 'checkbox',
                        title: '当章节已经学习完成至最后一章时，跳转到第一个章节重新开始学习。'
                    },
                    defaultValue: false
                },
                showTextareaWhenEdit: {
                    elementClassName: 'config-details',
                    label: '编辑时显示自定义编辑框',
                    showIf: 'cx.new.study.enables',
                    attrs: {
                        type: 'checkbox',
                        title: '超星默认禁止在编辑框中复制粘贴，开启此选项可以在文本框编辑时生成一个自定义编辑框进行编辑，脚本会将内容同步到编辑框中。'
                    },
                    defaultValue: true
                },
                notifyWhenHasFaceRecognition: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '出现人脸识别时通知我',
                    attrs: {
                        type: 'checkbox'
                    },
                    defaultValue: true
                },
                /**
                 *
                 * 开启的任务点
                 *
                 * media : 音视频
                 * ppt : 文档和书籍翻阅
                 * test : 章节测试
                 * read : 阅读
                 * live : 直播课
                 *
                 */
                enableMedia: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '视频/音频自动播放',
                    attrs: { type: 'checkbox', title: '开启：音频和视频的自动播放' },
                    defaultValue: true
                },
                enablePPT: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: 'PPT/书籍自动完成',
                    attrs: { type: 'checkbox', title: '开启：PPT/书籍自动翻阅' },
                    defaultValue: true
                },
                enableChapterTest: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '章节测试自动答题',
                    attrs: { type: 'checkbox', title: '开启：章节测试自动答题' },
                    defaultValue: true
                },
                enableHyperlink: {
                    elementClassName: 'config-details',
                    showIf: 'cx.new.study.enables',
                    label: '链接任务自动完成',
                    attrs: { type: 'checkbox', title: '开启：链接任务自动完成' },
                    defaultValue: true
                }
            },
            onrender({ panel }) {
                var _a;
                if (!((_a = common_1.CommonProject.scripts.settings.cfg.answererWrappers) === null || _a === void 0 ? void 0 : _a.length)) {
                    (0, work_1.answerWrapperEmptyWarning)(10);
                }
                // 高倍速警告
                this.offConfigChange(state.study.playbackRateWarningListenerId);
                state.study.playbackRateWarningListenerId =
                    this.onConfigChange('playbackRate', (playbackRate) => {
                        if (playbackRate > 2) {
                            easy_us_1.$modal.alert({
                                title: '⚠️高倍速警告 （倍速 >= 2）',
                                content: easy_us_1.$ui.notes(HIGHT_PLAYBACK_RATE_WARNS),
                                maskCloseable: false,
                                confirmButtonText: '我已知晓风险'
                            });
                        }
                    }) || 0;
            },
            // 这里不使用 oncompelete ，如果某个资源一直在加载中，就会导致 oncomplete 一直无法触发，导致脚本无法运行，所以改为 onactive 只要匹配上就会触发
            onactive() {
                return __awaiter(this, void 0, void 0, function* () {
                    /** iframe 跨域问题， 必须在 iframe 中执行 ， 所以脱离学习脚本运行。 */
                    if (/\/readsvr\/book\/mooc/.test(location.href)) {
                        // 26年上半学期新阅读任务点，计时翻页，达到一定时间才能翻下一页，这里等待时间然后执行翻页完成任务。
                        if (document.querySelector('#reader')) {
                            // @ts-ignore
                            require(['reader'], (_reader) => {
                                (0, study_1.waitForElement)('.readerPager').then(() => {
                                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        var _a;
                                        const jumper = document.querySelector('#pagejump');
                                        if ((_reader === null || _reader === void 0 ? void 0 : _reader.goPage) && jumper) {
                                            // 等待时间
                                            const timing = parseInt(((_a = new URL(location.href).searchParams.get('timing')) === null || _a === void 0 ? void 0 : _a.toString()) || '60') + 3;
                                            console.log(timing);
                                            yield core_1.$.sleep(timing * 1000);
                                            /**
                                                 *  1:书名页
                                                    2:版权页
                                                    3:前言页
                                                    4:目录页
                                                    5:正文275页
                                                    7:封底页
                                                */
                                            jumper.value = '5';
                                            jumper.dispatchEvent(new Event('change'));
                                            console.log('已跳转正文页');
                                            yield core_1.$.sleep(timing * 1000);
                                            jumper.value = '7';
                                            jumper.dispatchEvent(new Event('change'));
                                            console.log('已跳转封底页');
                                            yield core_1.$.sleep(timing * 1000);
                                            Array.from(document.querySelectorAll('.readerPager'))
                                                .filter((el) => el.style.zIndex === '101')[0]
                                                .click();
                                            console.log('阅读完成');
                                        }
                                    }), 3000);
                                });
                            });
                        }
                        // 普通阅读任务点，id 是 #ReadWeb
                        else {
                            background_1.$console.log('正在完成书籍/PPT...');
                            setTimeout(() => {
                                // @ts-ignore
                                // eslint-disable-next-line no-undef
                                readweb.goto(epage);
                            }, 5000);
                        }
                        return;
                    }
                    // 主要处理
                    if (/\/knowledge\/cards/.test(location.href)) {
                        const updateMediaState = () => {
                            // @ts-ignore
                            if (top.currentMedia) {
                                // @ts-ignore 倍速设置
                                top.currentMedia.playbackRate = parseFloat(this.cfg.playbackRate.toString());
                                // @ts-ignore 音量设置
                                top.currentMedia.volume = this.cfg.volume;
                            }
                        };
                        this.onConfigChange('playbackRate', updateMediaState);
                        this.onConfigChange('volume', updateMediaState);
                        yield study(Object.assign(Object.assign({}, this.cfg), { playbackRate: parseFloat(this.cfg.playbackRate.toString()) }));
                    }
                });
            }
        }),
        work: new easy_us_1.Script({
            name: '✍️ 作业考试脚本',
            matches: [
                ['作业页面', '/mooc2/work/dowork'],
                ['考试整卷预览页面', '/mooc2/exam/preview']
            ],
            namespace: 'cx.new.work',
            configs: { notes: configs_1.workNotes },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    const isExam = /\/exam\/preview/.test(location.href);
                    (0, work_1.commonWork)(this, {
                        workerProvider: (opts) => workOrExam(isExam ? 'exam' : 'work', Object.assign(Object.assign({}, opts), { preview_mode: true }))
                    });
                });
            }
        }),
        autoRead: new easy_us_1.Script({
            name: '🖥️ 自动阅读',
            matches: [
                ['阅读页面', '/ztnodedetailcontroller/visitnodedetail'],
                ['课程目录', /chaoxing.com\/course\/\d+\.html/],
                ['课程目录', /chaoxing.com\/mooc-ans\/course\/\d+\.html/],
                ['积分课阅读课程目录', '/mooc-ans/zt/portal']
            ],
            namespace: 'cx.new.auto-read',
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes(['点击任意章节开始自动阅读', '阅读任务次日才会统计阅读时长']).outerHTML
                },
                restartAfterFinish: {
                    label: '无限阅读',
                    attrs: { type: 'checkbox', title: '阅读完成最后一章后从头第一章继续阅读' },
                    defaultValue: false
                }
            },
            oncomplete() {
                // 置顶
                background_1.BackgroundProject.scripts.render.methods.pin(this);
                easy_us_1.$message.info('请手动点击任意章节开始自动阅读');
                // 自动进入章节功能，如果不是阅读页面则自动进入
                if (location.href.includes('/ztnodedetailcontroller/visitnodedetail') === false) {
                    startAtFirst();
                    return;
                }
                let top = 0;
                const interval = setInterval(() => {
                    top += (document.documentElement.scrollHeight - window.innerHeight) / 60;
                    window.scrollTo({
                        behavior: 'smooth',
                        top: top
                    });
                }, 1000);
                setTimeout(() => {
                    clearInterval(interval);
                    // 下一页
                    const next = (0, easy_us_1.$el)('.nodeItem.r i');
                    if (next) {
                        next.click();
                    }
                    else {
                        if (this.cfg.restartAfterFinish) {
                            setTimeout(() => startAtFirst(), 3000);
                            easy_us_1.$message.info({ content: '即将重新从头开始阅读', duration: 10 });
                            background_1.$console.log('即将重新从头开始阅读');
                        }
                        else {
                            easy_us_1.$message.success({ content: '阅读任务已完成', duration: 0 });
                            background_1.$console.log('未检测到下一页');
                        }
                    }
                }, (60 + 3) * 1000);
                // 点击第一个章节
                function startAtFirst() {
                    const texts = (0, easy_us_1.$$el)('.course_section .chapterText');
                    if (texts.length) {
                        texts[0].click();
                    }
                }
            }
        }),
        /**
         * 有时候进入课程会默认在，任务页面，会出现任务为空，部分用户会以为没有章节任务，所以添加此脚本
         */
        pageRedirect: new easy_us_1.Script({
            name: '章节页面自动切换脚本',
            matches: [['课程任务页面', 'pageHeader=0']],
            hideInPanel: true,
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (top === window) {
                        const a = document.querySelector('a[title="章节"]');
                        if (a) {
                            yield core_1.$.sleep(1000);
                            // 跳转到最新版本的超星
                            a.click();
                            easy_us_1.$message.info({
                                content: '已经为您自动切换到章节列表页面，手动进入任意章节即可开始自动学习！'
                            });
                        }
                    }
                });
            }
        }),
        versionRedirect: new easy_us_1.Script({
            name: '版本切换脚本',
            matches: [
                ['', 'mooc2=0'],
                ['', 'mycourse/studentcourse'],
                ['', 'work/getAllWork'],
                ['', 'work/doHomeWorkNew'],
                ['', 'exam/test\\?']
            ],
            hideInPanel: true,
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (top === window) {
                        easy_us_1.$message.warn({
                            content: 'OCS网课助手不支持旧版超星, 即将切换到超星新版, 如有其他第三方插件请关闭, 可能有兼容问题导致频繁切换。',
                            duration: 0
                        });
                        // 跳转到最新版本的超星
                        yield core_1.$.sleep(2000);
                        // 检测是否有人脸识别
                        yield waitForFaceRecognition();
                        const experience = document.querySelector('.experience');
                        if (experience) {
                            experience.click();
                        }
                        else {
                            const newUrl = new URL(window.location.href);
                            if (window.location.href.includes('mooc-ans/mycourse/studentstudy')) {
                                newUrl.pathname = '/mycourse/studentstudy';
                            }
                            const params = newUrl.searchParams;
                            let changed = false;
                            if (params.get('mooc2') !== '1') {
                                params.set('mooc2', '1');
                                changed = true;
                            }
                            // 兼容考试切换
                            if (params.get('newMooc') !== 'true') {
                                params.set('newMooc', 'true');
                                changed = true;
                            }
                            if (changed)
                                window.location.replace(newUrl);
                        }
                    }
                });
            }
        }),
        examRedirect: new easy_us_1.Script({
            name: '考试整卷预览脚本',
            hideInPanel: true,
            matches: [
                ['新版考试页面', 'exam-ans/exam/test/reVersionTestStartNew'],
                // 2023/9月 新增
                ['新版考试页面2', 'mooc-ans/exam/test/reVersionTestStartNew']
            ],
            configs: { notes: configs_1.workNotes },
            oncomplete() {
                var _a, _b;
                if ((_b = (_a = easy_us_1.$gm.unsafeWindow.document.querySelector('.mark_info')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes('不允许整卷预览')) {
                    easy_us_1.$message.warn({
                        content: easy_us_1.$ui.notes([
                            '由于当前考试禁止整卷预览，各题为独立新页面，只能一个个答题',
                            '在考完前禁止手动切换题目，否则会导致重复答题！',
                            '完成后或者开考前请手动删除搜索结果！',
                            '想加快速度请更改通用-全局设置-高级设置-搜题间隔，设置为 1-3 秒即可。'
                        ]),
                        duration: 0
                    });
                    const isExam = /\/exam\/test/.test(location.href);
                    const workOptions = common_1.CommonProject.scripts.settings.methods.getWorkOptions();
                    background_1.BackgroundProject.scripts.render.methods.pin(this);
                    (0, work_1.commonWork)(this, {
                        // 因为超星是每个题目一个页面，这里加快开始速度，避免等待，默认5秒，这里加快为默认3秒间隔
                        start_delay_seconds: workOptions.period,
                        workerProvider: (opts) => workOrExam(isExam ? 'exam' : 'work', Object.assign(Object.assign({}, opts), { preview_mode: false, thread: 1 }))
                    });
                    return;
                }
                easy_us_1.$message.info({ content: '即将跳转到整卷预览页面进行考试。' });
                setTimeout(() => easy_us_1.$gm.unsafeWindow.topreview(), 3000);
            }
        }),
        rateHack: new easy_us_1.Script({
            name: '屏蔽倍速限制',
            hideInPanel: true,
            matches: [['', '/ananas/modules/video/']],
            onstart() {
                rateHack();
            }
        }),
        copyHack: new easy_us_1.Script({
            name: '屏蔽复制粘贴限制',
            hideInPanel: true,
            matches: [['所有页面', /.*/]],
            methods() {
                return {
                    /** 解除输入框无法复制粘贴 */
                    hackEditorPaste() {
                        var _a, _b;
                        try {
                            const instants = ((_b = (_a = easy_us_1.$gm.unsafeWindow) === null || _a === void 0 ? void 0 : _a.UE) === null || _b === void 0 ? void 0 : _b.instants) || [];
                            for (const key in instants) {
                                const ue = instants[key];
                                /**
                                 * 新建一个文本框给用户编辑，然后同步到超星编辑器，防止http下浏览器无法读取剪贴板
                                 */
                                // eslint-disable-next-line no-proto
                                if (ue === null || ue === void 0 ? void 0 : ue.textarea) {
                                    ue.body.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
                                        // http 下无法读取剪贴板，通过弹窗让用户输入然后同步到编辑器
                                        if (exports.CXProject.scripts.study.cfg.showTextareaWhenEdit) {
                                            const defaultText = (0, easy_us_1.h)('span', { innerHTML: ue.textarea.value }).textContent;
                                            easy_us_1.$modal.prompt({
                                                content: '请在此文本框进行编辑，防止超星无法复制粘贴。(如需关闭请前往设置: 课程学习-编辑时显示自定义编辑框)',
                                                width: 800,
                                                inputDefaultValue: defaultText || '',
                                                modalInputType: 'textarea',
                                                onConfirm: (val = '') => {
                                                    ue.setContent(val
                                                        .split('\n')
                                                        .map((line) => `<p>${line}</p>`)
                                                        .join(''));
                                                }
                                            });
                                        }
                                    }));
                                    if (easy_us_1.$gm.unsafeWindow.editorPaste) {
                                        ue.removeListener('beforepaste', easy_us_1.$gm.unsafeWindow.editorPaste);
                                    }
                                    if (easy_us_1.$gm.unsafeWindow.myEditor_paste) {
                                        ue.removeListener('beforepaste', easy_us_1.$gm.unsafeWindow.myEditor_paste);
                                    }
                                }
                            }
                        }
                        catch (_c) { }
                    }
                };
            },
            oncomplete() {
                const hackInterval = setInterval(() => {
                    if (typeof easy_us_1.$gm.unsafeWindow.UE !== 'undefined') {
                        clearInterval(hackInterval);
                        this.methods.hackEditorPaste();
                        console.log('已解除输入框无法复制粘贴限制');
                    }
                }, 500);
            }
        }),
        studyDispatcher: new easy_us_1.Script({
            name: '课程学习调度器',
            matches: [['课程学习页面', '/mycourse/studentstudy']],
            namespace: 'cx.new.study-dispatcher',
            hideInPanel: true,
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    let chapters = yield CXAnalyses.waitForChapterInfos();
                    const params = new URLSearchParams(window.location.href);
                    const mooc = params.get('mooc2');
                    /** 切换新版 */
                    if (mooc === null) {
                        params.set('mooc2', '1');
                        window.location.replace(decodeURIComponent(params.toString()));
                        return;
                    }
                    // 寻找需要运行的任务
                    if (exports.CXProject.scripts.study.cfg.autoJumpToUnFinishJob) {
                        // 过滤掉已完成的章节
                        chapters = chapters.filter((chapter) => chapter.unFinishCount !== 0);
                        if (chapters.length === 0) {
                            easy_us_1.$message.warn({ content: '页面任务点数量为空! 请刷新重试!' });
                        }
                        else {
                            const params = new URLSearchParams(window.location.href);
                            const courseId = params.get('courseId');
                            const classId = params.get('clazzid');
                            //  进入需要进行的章节，并且当前章节未被选中
                            if ((0, easy_us_1.$$el)(`.posCatalog_active[id="cur${chapters[0].chapterId}"]`).length === 0) {
                                easy_us_1.$gm.unsafeWindow.getTeacherAjax(courseId, classId, chapters[0].chapterId);
                            }
                            yield core_1.$.sleep(1000);
                        }
                    }
                    // 自动滚动
                    yield core_1.$.sleep(1000);
                    CXAnalyses.scrollToActiveChapter();
                });
            }
        }),
        cxSecretFontRecognize: new easy_us_1.Script({
            name: '繁体字识别',
            hideInPanel: true,
            matches: [
                ['题目页面', 'work/doHomeWorkNew'],
                ['考试整卷预览', '/mooc2/exam/preview'],
                ['作业', '/mooc2/work/dowork']
            ],
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    yield mappingRecognize();
                });
            }
        }),
        // 积分课提示
        jfkGuide: new easy_us_1.Script({
            name: '💡 积分课使用提示',
            matches: [['积分课页面', '/plaza']],
            namespace: 'cx.jfk.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['进入课程', '开启复习模式，并关闭自动下一章', '课程完成后手动切换']).outerHTML +
                        easy_us_1.$ui.notes(['⚠️ 如果由脚本进行自动跳转会出现乱跳转的可能，请手动切换课程。']).outerHTML
                }
            },
            oncomplete(...args) {
                background_1.BackgroundProject.scripts.render.methods.pin(this);
            }
        })
    }
});
function workOrExam(type = 'work', { answererWrappers, period, thread, redundanceWordsText, answerSeparators, preview_mode }) {
    easy_us_1.$message.info(`开始${type === 'work' ? '作业' : '考试'}`);
    if (preview_mode) {
        common_1.CommonProject.scripts.workResults.methods.init({
            questionPositionSyncHandlerType: 'cx'
        });
    }
    // 处理作业和考试题目的方法
    const workOrExamQuestionTitleTransform = (titles) => {
        // 是否为多个小题的题目
        const is_multiple_question = titles.length > 1;
        const images = [];
        const optimizationTitle = titles
            .map((el, i) => {
            var _a, _b;
            if (el) {
                const titleCloneEl = el.cloneNode(true);
                const childNodes = titleCloneEl.childNodes;
                // 一般多小题题目只有第一个 title 存在题型文本
                if (i === 0) {
                    // 删除序号
                    (_a = childNodes[0]) === null || _a === void 0 ? void 0 : _a.remove();
                    // 删除题型
                    (_b = childNodes[0]) === null || _b === void 0 ? void 0 : _b.remove();
                }
                // 结构化遍历提取文本与图片 URL（不改造 DOM、不读 innerText）
                const extracted = (0, work_1.extractTextWithImages)(titleCloneEl);
                images.push(...extracted.images);
                return extracted.text;
            }
            return '';
        })
            .join('\n');
        const text = (0, work_1.removeRedundantWords)(core_1.StringUtils.of(optimizationTitle)
            .nowrap(is_multiple_question ? '\n' : ' ')
            .nospace()
            .toString()
            .trim(), redundanceWordsText.split('\n'));
        return { text, images };
    };
    /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
    const workOrExamQuestionTitleText = (titles) => workOrExamQuestionTitleTransform(titles).text;
    // 这里跟章节测试的连线题不一样，章节测试是新版连线题
    /** 新建答题器 */
    const worker = new core_1.OCSWorker({
        root: '.questionLi',
        elements: {
            title: (root) => (0, easy_us_1.$$el)(
            // 非预览模式的样式跟正常的不一样
            !preview_mode
                ? ['.splitS-left .mark_name', '.line_wid_half.fl,.line_wid_half.fr'].join(',')
                : [
                    ':scope > h3',
                    ':scope > div:not(.stem_answer,.mark_answer)',
                    ':scope > p',
                    '.line_wid_half.fl,.line_wid_half.fr'
                ].join(','), root).filter((e) => { var _a; return !!((_a = e.textContent) === null || _a === void 0 ? void 0 : _a.trim()); }),
            options: '.answerBg .answer_p, .textDIV, .eidtDiv',
            type: type === 'exam' ? 'input[name^="type"]' : 'input[id^="answertype"]',
            lineAnswerInput: '.line_answer input[name^=answer]',
            lineSelectBox: '.line_answer_ct .selectBox ',
            /** 阅读理解 */
            reading: '.reading_answer',
            /** 完形填空 */
            filling: '.filling_answer'
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        /** 默认搜题方法构造器 */
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements, ctx) => {
                if (elements.title) {
                    return workOrExamQuestionTitleTransform(elements.title);
                }
                return '';
            },
            optionsTransform: (elements, ctx) => {
                var _a, _b;
                const typeInput = (_a = elements.type) === null || _a === void 0 ? void 0 : _a[0];
                const type = (typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined) || 'unknown';
                ctx.type = type;
                if (type === 'completion')
                    return '';
                const optResults = ((_b = ctx.elements.options) !== null && _b !== void 0 ? _b : []).filter(Boolean).map((o) => (0, work_1.extractTextWithImages)(o));
                return {
                    text: optResults.map((r) => r.text).join('\n'),
                    images: optResults.flatMap((r) => r.images)
                };
            },
            answererWrappers,
            period
        }),
        work: (ctx) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { elements, searchInfos } = ctx;
            // 在非预览模式下会出现多个干扰项 type，这里提取正确的
            const type = getQuestionType(parseInt(((_a = elements.type.find((t) => { var _a; return (_a = t.getAttribute('name')) === null || _a === void 0 ? void 0 : _a.match(/type\d+/); })) === null || _a === void 0 ? void 0 : _a.getAttribute('value')) || '-1'));
            if (type && (type === 'completion' || type === 'multiple' || type === 'judgement' || type === 'single')) {
                const resolver = (0, core_1.createDefaultQuestionResolver)(ctx, (o) => (0, work_1.extractTextWithImages)(o).text)[type];
                return yield resolver(searchInfos, elements.options, (type, answer, option) => __awaiter(this, void 0, void 0, function* () {
                    var _c, _d, _e;
                    // 如果存在已经选择的选项
                    if (type === 'judgement' || type === 'single' || type === 'multiple') {
                        if ((option === null || option === void 0 ? void 0 : option.parentElement) && (0, easy_us_1.$$el)('[class*="check_answer"]', option.parentElement).length === 0) {
                            option.click();
                            yield core_1.$.sleep(500);
                        }
                    }
                    else if (type === 'completion' && answer.trim()) {
                        const text = option === null || option === void 0 ? void 0 : option.querySelector('textarea');
                        const textareaFrame = option === null || option === void 0 ? void 0 : option.querySelector('iframe');
                        if (text) {
                            text.value = answer;
                        }
                        if (textareaFrame === null || textareaFrame === void 0 ? void 0 : textareaFrame.contentDocument) {
                            textareaFrame.contentDocument.body.innerHTML = answer;
                        }
                        if ((_c = option === null || option === void 0 ? void 0 : option.parentElement) === null || _c === void 0 ? void 0 : _c.parentElement) {
                            /** 如果存在保存按钮则点击 */
                            (_e = (0, easy_us_1.$el)('[onclick*=saveQuestion]', (_d = option === null || option === void 0 ? void 0 : option.parentElement) === null || _d === void 0 ? void 0 : _d.parentElement)) === null || _e === void 0 ? void 0 : _e.click();
                            yield core_1.$.sleep(500);
                        }
                    }
                }));
            }
            // 连线题自定义处理
            else if (type && type === 'line') {
                for (const answers of searchInfos.map((info) => info.results.map((res) => res.answer))) {
                    let ans = answers;
                    if (ans.length === 1) {
                        ans = (0, core_1.splitAnswer)(ans[0]);
                    }
                    if (ans.filter(Boolean).length !== 0 &&
                        elements.lineAnswerInput &&
                        ans.filter(Boolean).length === elements.lineSelectBox.length) {
                        //  选择答案
                        for (let index = 0; index < elements.lineSelectBox.length; index++) {
                            const box = elements.lineSelectBox[index];
                            if (ans[index]) {
                                (_b = (0, easy_us_1.$el)(`li[data=${ans[index]}] a`, box)) === null || _b === void 0 ? void 0 : _b.click();
                                yield core_1.$.sleep(200);
                            }
                        }
                        return { finish: true };
                    }
                }
                return { finish: false };
            }
            // 完形填空
            else if (type && type === 'fill') {
                return readerAndFillHandle(searchInfos, elements.filling);
            }
            // 阅读理解
            else if (type && type === 'reader') {
                return readerAndFillHandle(searchInfos, elements.reading);
            }
            return { finish: false };
        }),
        /** 检测到题目（非预览模式：在结果面板提前占位"等待搜索中"，预览模式由 setResults 全量展示无需占位） */
        onQuestionDetected(current) {
            if (preview_mode) {
                return;
            }
            (0, work_1.updateDynamicResult)(current, workOrExamQuestionTitleText);
        },
        /** 完成答题后 */
        onResultsUpdate(current, _, res) {
            var _a, _b;
            return __awaiter(this, void 0, void 0, function* () {
                // 非预览模式：逐题更新（等待搜索中→等待答题中→已答题/失败），想要清空只能手动清空
                if (!preview_mode) {
                    (0, work_1.updateDynamicResult)(current, workOrExamQuestionTitleText);
                    if ((_a = current.result) === null || _a === void 0 ? void 0 : _a.finish) {
                        background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], workOrExamQuestionTitleText));
                    }
                    return;
                }
                common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, workOrExamQuestionTitleText));
                common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
                if ((_b = current.result) === null || _b === void 0 ? void 0 : _b.finish) {
                    background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([current], workOrExamQuestionTitleText));
                }
            });
        }
    });
    if (preview_mode) {
        worker
            .doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug })
            .then(() => {
            easy_us_1.$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
            worker.emit('done');
        })
            .catch((err) => {
            console.error(err);
            easy_us_1.$message.error('答题程序发生错误 : ' + err.message);
        });
    }
    else {
        const getNextBtn = () => document.querySelector('[onclick="getTheNextQuestion(1)"]');
        let next = getNextBtn();
        (() => __awaiter(this, void 0, void 0, function* () {
            while (next && worker.isClose === false) {
                yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
                easy_us_1.$message.info({ content: '已完成，即将下一题', duration: 0 });
                yield core_1.$.sleep(3000);
                next = getNextBtn();
                next === null || next === void 0 ? void 0 : next.click();
                yield core_1.$.sleep(1000);
            }
            easy_us_1.$message.success({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
            worker.emit('done');
            // 搜索完成后才会同步答案与题目的显示，防止题目错乱
            common_1.CommonProject.scripts.workResults.cfg.questionPositionSyncHandlerType = 'cx';
        }))();
    }
    return worker;
}
/**
 * 加密文字识别（字形置换解密）
 *
 * 超星 font-cxsecret 加密原理：页面内嵌 base64 字体（SourceHanSansCN-Normal 子集），
 * 字体中码点 X 的字形轮廓实际画的是另一个字，浏览器渲染正常但 HTML 文本是乱码。
 *
 * 本实现使用"位图特征匹配"解密（utils/font-decrypt 框架）：
 * 渲染密文字 -> 与官方原版字体的预计算特征表做最近邻匹配 -> 还原真实字符。
 * 相比旧的 typr.js 路径哈希方案，优势是抗"轮廓扰动"（新版 cx 字体的撇捺位移），
 * 特征表由官方字体一次生成，无需随平台改字体而更新维护。
 *
 * @see 算法详解见 utils/font-decrypt/bitmap.ts 文件头注释
 * @see 参考 https://bbs.tampermonkey.net.cn/thread-2303-1-1.html
 */
function mappingRecognize(doc = document) {
    return __awaiter(this, void 0, void 0, function* () {
        // 从 @font-face 的 data URI 中提取加密字体
        const fontBuffer = (0, font_decrypt_1.extractFontFromStyle)(doc, 'font-cxsecret');
        if (!fontBuffer) {
            background_1.$console.log('未检测到加密文字。');
            return;
        }
        const fonts = CXAnalyses.getSecretFont(doc);
        if (fonts.length === 0) {
            return;
        }
        const t = Date.now();
        try {
            // 只破解页面实际出现的字符（通常几十个），避免全字表扫描
            const { map, details } = yield (0, font_decrypt_1.crackFont)(fontBuffer, (0, font_decrypt_1.collectChars)(fonts), {
                refTableUrl: CX_SECRET_REF_TABLE_URL,
                onProgress: (done, total) => console.log(`加密文字识别中 ${done}/${total}`)
            });
            const lowMargin = details.filter((d) => d.margin < 0.3);
            if (lowMargin.length > 0) {
                const msg = `有 ${lowMargin.length} 个字符识别置信度较低，可能存在误差`;
                background_1.$console.warn(msg);
                console.log(msg, lowMargin);
            }
            (0, font_decrypt_1.decryptElements)(fonts, map);
            fonts.forEach((el) => el.classList.remove('font-cxsecret')); // 移除字体加密
            easy_us_1.$message.info('文字解密完成，耗时 ' + ((Date.now() - t) / 1000).toFixed(1) + ' 秒');
        }
        catch (err) {
            background_1.$console.error('加密文字识别失败：', String(err));
        }
    });
}
/**
 * cx分析工具
 */
const CXAnalyses = {
    /** 是否处于闯关模式或者解锁模式 */
    isInSpecialMode() {
        return Array.from((top === null || top === void 0 ? void 0 : top.document.querySelectorAll('.catalog_points_sa,.catalog_points_er')) || []).length !== 0;
    },
    /** 是否为闯关模式，并且当前章节卡在最后一个待完成的任务点 */
    isStuckInBreakingMode() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInSpecialMode()) {
                const chapter = top === null || top === void 0 ? void 0 : top.document.querySelector('.posCatalog_active');
                if (chapter) {
                    const id = chapter.getAttribute('id');
                    if (id) {
                        // 超星好像会重绘组件，导致无法绑定属性到元素中，所以这里使用页面全局变量存储
                        const counter = (yield easy_us_1.$store.getTab('chapter_counter')) || Object.create({});
                        let count = Reflect.get(counter, id);
                        count = count ? count + 1 : 1;
                        Reflect.set(counter, id, count);
                        let res = false;
                        if (count >= 3) {
                            Reflect.set(counter, id, 1);
                            res = true;
                        }
                        yield easy_us_1.$store.setTab('chapter_counter', counter);
                        return res;
                    }
                }
            }
            return false;
        });
    },
    /**
     * 是否处于最后一小节
     * 当小节为0，返回 true
     */
    isInFinalTab() {
        // 上方小节任务栏
        const tabs = Array.from((top === null || top === void 0 ? void 0 : top.document.querySelectorAll('.prev_ul li')) || []);
        if (tabs.length === 0) {
            return true;
        }
        return tabs[tabs.length - 1].classList.contains('active');
    },
    /** 是否处于最后一个章节 */
    isInFinalChapter() {
        var _a;
        return (_a = Array.from((top === null || top === void 0 ? void 0 : top.document.querySelectorAll('.posCatalog_select')) || [])
            .pop()) === null || _a === void 0 ? void 0 : _a.classList.contains('posCatalog_active');
    },
    /** 是否完成全部章节 */
    isFinishedAllChapters() {
        return this.getChapterInfos().every((chapter) => chapter.unFinishCount === 0);
    },
    /** 获取所有章节信息 */
    getChapterInfos() {
        return Array.from((top === null || top === void 0 ? void 0 : top.document.querySelectorAll('[onclick^="getTeacherAjax"]')) || []).map((el) => {
            var _a, _b, _c;
            return ({
                element: el,
                chapterId: (_b = (_a = el.getAttribute('onclick')) === null || _a === void 0 ? void 0 : _a.match(/\('(.*)','(.*)','(.*)'\)/)) === null || _b === void 0 ? void 0 : _b[3],
                // @ts-ignore
                unFinishCount: parseInt(((_c = el.parentElement.querySelector('.jobUnfinishCount')) === null || _c === void 0 ? void 0 : _c.value) || '0')
            });
        });
    },
    scrollToActiveChapter() {
        const activeChapter = top === null || top === void 0 ? void 0 : top.document.querySelector('.posCatalog_active');
        if (activeChapter) {
            activeChapter.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },
    /**
     * 等待并获取章节信息，直到获取到章节信息为止
     * - 可设置超时时间（单位秒），默认10秒
     * - 超时后返回空数组
     */
    waitForChapterInfos(timeout = 10) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const res = this.getChapterInfos();
                if (res.length > 0) {
                    clearInterval(interval);
                    clearInterval(to);
                    resolve(res);
                }
            }, 1000);
            const to = setTimeout(() => {
                clearInterval(interval);
                resolve([]);
            }, timeout * 1000);
        });
    },
    /** 检测页面是否使用字体加密 */
    getSecretFont(doc = document) {
        return Array.from(doc.querySelectorAll('.font-cxsecret')).map((font) => {
            // 这里吧选项按钮和文字分离，如果不分离的话 .font-cxsecret 元素下面还包含选项按钮时，替换时会吧按钮也删除掉导致选项按钮不可用
            const after = font.querySelector('.after');
            return after === null ? font : after;
        });
    },
    /**
     * 检测当前章节是否完成
     */
    isCurrentChapterFinished() {
        const job = top === null || top === void 0 ? void 0 : top.document.querySelector('.posCatalog_active');
        if (job) {
            if (job.querySelector('.icon_Completed') !== null) {
                return true;
            }
        }
        return false;
    }
};
/**
 * 屏蔽倍速限制
 */
function rateHack() {
    state.study.hacked = false;
    let dragCount = 0;
    try {
        hack();
        window.document.addEventListener('readystatechange', hack);
        window.addEventListener('load', hack);
    }
    catch (e) {
        console.error(e);
    }
    function hack() {
        const videojs = easy_us_1.$gm.unsafeWindow.videojs;
        const Ext = easy_us_1.$gm.unsafeWindow.Ext;
        if (typeof videojs !== 'undefined' && typeof Ext !== 'undefined') {
            if (state.study.hacked) {
                return;
            }
            state.study.hacked = true;
            const _origin = videojs.getPlugin('seekBarControl');
            const plugin = videojs.extend(videojs.getPlugin('plugin'), {
                constructor: function (videoExt, data) {
                    const _sendLog = data.sendLog;
                    data.sendLog = (...args) => {
                        var _a;
                        if (args[1] === 'drag') {
                            dragCount++;
                            // 开始播放的时候偶尔会卡顿，导致一直触发 drag 事件（超星的BUG）
                            // 这里如果卡顿太多，尝试暂停视频，然后等待视频自动开始。
                            if (dragCount > 100) {
                                dragCount = 0;
                                (_a = (0, easy_us_1.$el)('video')) === null || _a === void 0 ? void 0 : _a.pause();
                            }
                        }
                        else {
                            _sendLog.apply(data, args);
                        }
                    };
                    _origin.apply(_origin.prototype, [videoExt, data]);
                }
            });
            videojs.registerPlugin('seekBarControl', plugin);
            // 重写超星视频插件
            Ext.define('ans.VideoJs', {
                override: 'ans.VideoJs',
                constructor: function (data) {
                    this.addEvents(['seekstart']);
                    this.mixins.observable.constructor.call(this, data);
                    const vjs = videojs(data.videojs, this.params2VideoOpt(data.params), function () { });
                    Ext.fly(data.videojs).on('contextmenu', function (f) {
                        f.preventDefault();
                    });
                    Ext.fly(data.videojs).on('keydown', function (f) {
                        if (f.keyCode === 32 || f.keyCode === 37 || f.keyCode === 39 || f.keyCode === 107) {
                            f.preventDefault();
                        }
                    });
                    // 保存清晰度设置
                    if (vjs.videoJsResolutionSwitcher) {
                        vjs.on('resolutionchange', function () {
                            const cr = vjs.currentResolution();
                            const re = cr.sources ? cr.sources[0].res : false;
                            Ext.setCookie('resolution', re);
                        });
                    }
                    // 保存公网设置
                    if (vjs.videoJsPlayLine) {
                        vjs.on('playlinechange', function () {
                            const cp = vjs.currentPlayline();
                            Ext.setCookie('net', cp.net);
                        });
                    }
                    // 下面连着一个倍速限制方法，这里直接不写，实现可以倍速
                }
            });
        }
    }
}
/**
 * cx 任务学习
 */
function study(opts) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        yield core_1.$.sleep(3000);
        const searchedJobs = [];
        let searching = true;
        let attachmentCount = ((_a = easy_us_1.$gm.unsafeWindow.attachments) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const wait_timeout = 3 + attachmentCount * 2;
        /** 考虑到网速级慢的同学，所以10秒后如果还没有任务点才停止 */
        setTimeout(() => {
            searching = false;
        }, Math.min(wait_timeout, 10) * 1000);
        /**
         * 递归运行任务点，一旦有新的任务点被检测到直接开始
         * 如果10秒内既没有任务点，也暂停了搜索，则当前则没有任务点
         */
        const runJobs = () => __awaiter(this, void 0, void 0, function* () {
            const job = searchJob(opts, searchedJobs);
            // 如果存在任务点
            if (job && job.func) {
                try {
                    yield job.func();
                }
                catch (e) {
                    background_1.$console.error('未知错误', e);
                }
                yield core_1.$.sleep(1000);
                yield runJobs();
            }
            // 每次 search 一次，就减少一次文件数量
            // 如果不加这个判断，三个任务中，中间的任务不是任务点，则会导致下面的任务全部不执行。
            else if (attachmentCount > 0) {
                attachmentCount--;
                yield core_1.$.sleep(1000);
                yield runJobs();
            }
            // 或者正在搜索
            else if (searching) {
                yield core_1.$.sleep(1000);
                yield runJobs();
            }
        });
        yield runJobs();
        // @ts-ignore
        top._preChapterId = '';
        // 下一章
        const next = () => __awaiter(this, void 0, void 0, function* () {
            if (CXAnalyses.isInFinalTab()) {
                if (yield CXAnalyses.isStuckInBreakingMode()) {
                    return easy_us_1.$modal.alert({
                        content: '检测到当前课程为闯关模式（有小旗帜图标）, 但是已经重复进入多次，应该是章节测试没有完成，或者其他情况导致，请手动完成章节测试，然后手动点击下一章。'
                    });
                }
            }
            if (CXAnalyses.isInFinalChapter()) {
                let content = '';
                if (opts.backToFirstWhenFinish) {
                    content = '已经抵达最后一个章节，10秒后返回第一个章节重新开始。';
                    setTimeout(() => {
                        var _a;
                        (_a = top === null || top === void 0 ? void 0 : top.document.querySelector('.posCatalog_name')) === null || _a === void 0 ? void 0 : _a.click();
                    }, 10 * 1000);
                    easy_us_1.$message.info({ content, duration: 30 });
                }
                else {
                    if (CXAnalyses.isFinishedAllChapters()) {
                        content = '全部任务点已完成！';
                    }
                    else {
                        content = '已经抵达最后一个章节！但仍然有任务点未完成，请手动切换至未完成的章节。';
                    }
                    easy_us_1.$modal.alert({ content: content });
                }
                common_1.CommonProject.scripts.settings.methods.notificationBySetting(content, {
                    duration: 0,
                    extraTitle: '超星学习通学习脚本'
                });
                return;
            }
            if (exports.CXProject.scripts.study.cfg.mode === 'job') {
                // 检测当前章节是否完成，如果已经完成则下一章
                // 如果没有需要完成的章节，则暂停运行
                if (CXAnalyses.isInFinalTab()) {
                    // 找到未完成
                    const elements = CXAnalyses.getChapterInfos()
                        .filter((el) => { var _a; return el.unFinishCount > 0 || ((_a = el.element.parentElement) === null || _a === void 0 ? void 0 : _a.classList.contains('posCatalog_active')); })
                        .map((el) => el.element.parentElement);
                    if (elements.length === 0) {
                        const content = '全部任务点已完成！';
                        easy_us_1.$modal.alert({ content: content });
                        common_1.CommonProject.scripts.settings.methods.notificationBySetting(content, {
                            duration: 0,
                            extraTitle: '超星学习通学习脚本'
                        });
                        return;
                    }
                    let nextChapter = elements[0];
                    // 如果当前章节未完成，则跳转到下一个未完成章节
                    const currentIndex = elements.findIndex((el) => el.classList.contains('posCatalog_active'));
                    if (currentIndex !== -1 && currentIndex + 1 < elements.length) {
                        nextChapter = elements[currentIndex + 1];
                        CXAnalyses.scrollToActiveChapter();
                        setTimeout(() => {
                            var _a;
                            (_a = nextChapter.querySelector('.posCatalog_name')) === null || _a === void 0 ? void 0 : _a.click();
                        }, 1000);
                    }
                }
            }
            else if (exports.CXProject.scripts.study.cfg.mode === 'next') {
                const curCourseId = (0, easy_us_1.$el)('#curCourseId', top === null || top === void 0 ? void 0 : top.document);
                const curChapterId = (0, easy_us_1.$el)('#curChapterId', top === null || top === void 0 ? void 0 : top.document);
                const curClazzId = (0, easy_us_1.$el)('#curClazzId', top === null || top === void 0 ? void 0 : top.document);
                const count = (0, easy_us_1.$$el)('#prev_tab .prev_ul li', top === null || top === void 0 ? void 0 : top.document);
                // 自动下一个小节（点击下一节）
                if (curChapterId && curCourseId && curClazzId) {
                    // @ts-ignore
                    top._preChapterId = curChapterId.value;
                    CXAnalyses.scrollToActiveChapter();
                    // 等待跳转动画完成
                    yield core_1.$.sleep(200);
                    /**
                     * count, chapterId, courseId, clazzid, knowledgestr, checkType
                     * checkType 就是询问当前章节还有任务点未完成，是否完成，这里直接不传，默认下一章
                     */
                    // @ts-ignore
                    top === null || top === void 0 ? void 0 : top.PCount.next(count.length.toString(), curChapterId.value, curCourseId.value, curClazzId.value, '');
                }
                else {
                    background_1.$console.warn('参数错误，无法跳转下一章，请尝试手动切换。');
                }
            }
            else {
                background_1.$console.warn('未知的跳转模式，请联系作者反馈');
            }
        });
        if (exports.CXProject.scripts.study.cfg.mode !== 'manually') {
            const msg = '页面任务点已完成，即将跳转。';
            easy_us_1.$message.success({ content: msg });
            background_1.$console.info(msg);
            yield core_1.$.sleep(5000);
            next();
        }
        else {
            const msg = '页面任务点已完成，自动跳转已关闭，请手动跳转。';
            easy_us_1.$message.warn({ content: msg, duration: 0 });
            background_1.$console.warn(msg);
        }
    });
}
exports.study = study;
function searchIFrame(root) {
    var _a, _b;
    let list = Array.from(root.querySelectorAll('iframe'));
    const result = [];
    while (list.length) {
        const frame = list.shift();
        try {
            if (frame && ((_a = frame === null || frame === void 0 ? void 0 : frame.contentWindow) === null || _a === void 0 ? void 0 : _a.document)) {
                result.push(frame);
                const frames = (_b = frame === null || frame === void 0 ? void 0 : frame.contentWindow) === null || _b === void 0 ? void 0 : _b.document.querySelectorAll('iframe');
                list = list.concat(Array.from(frames || []));
            }
        }
        catch (e) {
            // @ts-ignore
            console.log(e.message);
        }
    }
    return result;
}
/**
 * 搜索任务点
 */
function searchJob(opts, searchedJobs) {
    const knowCardWin = easy_us_1.$gm.unsafeWindow;
    const searchJobElement = (root) => {
        return (0, core_1.domSearch)({
            videojs: '#video,#audio',
            chapterTest: '.TiMu',
            read: '#img.imglook',
            pptWithAudio: '.swiper-container',
            hyperlink: '#hyperlink',
            timereader: 'iframe[name="bookifame"][src*="timing"]'
        }, root.contentWindow.document);
    };
    const search = (root) => {
        var _a, _b, _c, _d;
        const win = root.contentWindow;
        const { videojs, read, chapterTest, hyperlink, pptWithAudio, timereader } = searchJobElement(root);
        if (win && (videojs || read || chapterTest || hyperlink || pptWithAudio || timereader)) {
            // 获取任务点数据字符串
            const frame_data_str = ((_a = win.frameElement) === null || _a === void 0 ? void 0 : _a.getAttribute('data')) ||
                (
                // 带音频的PPT，套了两层iframe
                (_d = (_c = (_b = win.frameElement) === null || _b === void 0 ? void 0 : _b.contentWindow) === null || _c === void 0 ? void 0 : _c.parent.frameElement) === null || _d === void 0 ? void 0 : _d.getAttribute('data')) ||
                '{}';
            const frame_data = JSON.parse(frame_data_str);
            const target_jobid = frame_data.jobid || frame_data._jobid;
            if (!target_jobid) {
                return;
            }
            // 获取任务点数据
            const attachment = knowCardWin.attachments.find((attachment) => {
                const attachment_jobid = attachment.jobid || attachment.property._jobid;
                if (!attachment_jobid) {
                    return false;
                }
                return String(attachment_jobid) === String(target_jobid);
            });
            // 任务点去重
            if (attachment && searchedJobs.find((job) => job.mid === attachment.property.mid) === undefined) {
                const { name, title, bookname, author } = attachment.property;
                const jobName = name || title || (bookname ? bookname + author : undefined) || '未知任务';
                const work_type = attachment.job ? 'job' : attachment.isPassed ? 'finished' : 'not-job';
                let func;
                if (videojs) {
                    if (!exports.CXProject.scripts.study.cfg.enableMedia) {
                        const msg = `音视频自动学习功能已被关闭（在上方菜单栏，超星学习通-课程学习中开启）。${jobName} 即将跳过`;
                        easy_us_1.$message.warn({ content: msg, duration: 10 });
                        background_1.$console.warn(msg);
                    }
                    else {
                        if (
                        // 未完成
                        work_type === 'job' ||
                            // 重复学习
                            (work_type === 'finished' && opts.restudy) ||
                            // 强制学习
                            (work_type === 'not-job' && opts.forceLearn)) {
                            func = () => {
                                const msg = `即将${work_type === 'finished' && opts.restudy
                                    ? '重新'
                                    : work_type === 'not-job' && opts.forceLearn
                                        ? '强制'
                                        : ''}播放 : ` + jobName;
                                easy_us_1.$message.info({ content: msg });
                                background_1.$console.log(msg);
                                return JobRunner.media(opts, win.document);
                            };
                        }
                    }
                }
                else if (chapterTest) {
                    if (!exports.CXProject.scripts.study.cfg.enableChapterTest) {
                        const msg = `章节测试自动答题功能已被关闭（在上方菜单栏，超星学习通-课程学习中开启）。${jobName} 即将跳过`;
                        easy_us_1.$message.warn({ content: msg, duration: 10 });
                        background_1.$console.warn(msg);
                    }
                    else {
                        const status = win.document.querySelector('.testTit_status');
                        // 已完成
                        if (status === null || status === void 0 ? void 0 : status.classList.contains('testTit_status_complete')) {
                            const msg = `章节测试已完成 : ` + jobName;
                            easy_us_1.$message.success({ content: msg });
                            background_1.$console.log(msg);
                        }
                        else {
                            if (
                            // 未完成
                            work_type === 'job' ||
                                // / 强制学习
                                (work_type === 'not-job' && common_1.CommonProject.scripts.settings.cfg['work-when-no-job'])) {
                                const workOptions = common_1.CommonProject.scripts.settings.methods.getWorkOptions();
                                if (workOptions.answererWrappers === undefined || workOptions.answererWrappers.length === 0) {
                                    (0, work_1.answerWrapperEmptyWarning)(0);
                                }
                                else {
                                    func = () => {
                                        const msg = `开始答题 : ` + jobName;
                                        easy_us_1.$message.info({ content: msg });
                                        background_1.$console.log(msg);
                                        return JobRunner.chapter(root, workOptions);
                                    };
                                }
                            }
                            if (work_type === 'not-job' && common_1.CommonProject.scripts.settings.cfg['work-when-no-job'] === false) {
                                const msg = `当前作业 ${jobName} 不是任务点，但待完成，如需开启自动答题请前往：通用-全局设置，开启强制答题。`;
                                easy_us_1.$message.warn({ content: msg });
                                background_1.$console.warn(msg);
                            }
                        }
                    }
                }
                else if (read || pptWithAudio || timereader) {
                    if (!exports.CXProject.scripts.study.cfg.enablePPT) {
                        const msg = `PPT/书籍阅读功能已被关闭（在上方菜单栏，超星学习通-课程学习中开启）。${jobName} 即将跳过`;
                        easy_us_1.$message.warn({ content: msg, duration: 10 });
                        background_1.$console.warn(msg);
                    }
                    else {
                        if (attachment.job) {
                            func = () => {
                                const msg = `正在学习 : ` + jobName;
                                easy_us_1.$message.info({ content: msg });
                                background_1.$console.log(msg);
                                if (read) {
                                    return JobRunner.read(win);
                                }
                                else if (timereader) {
                                    return JobRunner.timereader(timereader);
                                }
                                else {
                                    return JobRunner.readPPTWithAudio(win);
                                }
                            };
                        }
                    }
                }
                else if (hyperlink) {
                    if (!exports.CXProject.scripts.study.cfg.enableHyperlink) {
                        const msg = `链接任务点已被关闭（在上方菜单栏，超星学习通-课程学习中开启）。${jobName} 即将跳过`;
                        easy_us_1.$message.warn({ content: msg, duration: 10 });
                        background_1.$console.warn(msg);
                    }
                    else {
                        if (attachment.job) {
                            func = () => {
                                const msg = `正在完成链接阅读任务 : ` + jobName;
                                easy_us_1.$message.info({ content: msg });
                                background_1.$console.log(msg);
                                return JobRunner.hyperlink(hyperlink);
                            };
                        }
                    }
                }
                const job = {
                    mid: attachment.property.mid,
                    attachment: attachment,
                    func: func
                };
                searchedJobs.push(job);
                return job;
            }
        }
    };
    let job;
    for (const iframe of searchIFrame(knowCardWin.document)) {
        job = search(iframe);
        if (job) {
            return job;
        }
    }
    return job;
}
/**
 * 永久固定显示视频进度
 */
function fixedVideoProgress() {
    if (state.study.videojs) {
        const { bar } = (0, core_1.domSearch)({ bar: '.vjs-control-bar' }, state.study.videojs);
        if (bar) {
            bar.style.opacity = '1';
        }
    }
}
exports.fixedVideoProgress = fixedVideoProgress;
/**
 * 任务点运行器
 */
const JobRunner = {
    /**
     * 播放视频和音频
     */
    media(setting, doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const { playbackRate = 1, volume = 0 } = setting;
            const media = yield (0, study_1.waitForMedia)({ root: doc });
            // @ts-ignore
            const { videojs } = (0, core_1.domSearch)({ videojs: '#video,#audio' }, doc);
            if (!videojs || !media) {
                background_1.$console.error('视频检测不到，请尝试刷新或者手动切换下一章。');
                return;
            }
            state.study.videojs = videojs;
            // @ts-ignore
            top.currentMedia = media;
            // 固定视频进度
            fixedVideoProgress();
            // 随机作答视频内题目
            if (setting.videoQuizStrategy === 'random') {
                const loop = () => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const submitBtn = () => doc.querySelector('#videoquiz-submit');
                    if (submitBtn()) {
                        const list = Array.from(doc.querySelectorAll('.ans-videoquiz-opt label'));
                        const answer = list[Math.floor(Math.random() * list.length)];
                        answer === null || answer === void 0 ? void 0 : answer.click();
                        (_a = submitBtn()) === null || _a === void 0 ? void 0 : _a.click();
                        yield core_1.$.sleep(3000);
                        // 隐藏视频内题目元素
                        const container = doc.querySelector('#video .ans-videoquiz');
                        const components = Array.from(doc.querySelectorAll('.x-component-default'));
                        if (container) {
                            container.remove();
                        }
                        if (components.length) {
                            for (const com of components) {
                                com.style.display = 'none';
                            }
                        }
                    }
                    yield core_1.$.sleep(3000);
                    yield loop();
                });
                loop();
            }
            /**
             * 视频播放
             */
            return new Promise((resolve, reject) => {
                // 检测视频
                const reloadInterval = setInterval(() => {
                    const errorDiv = doc.querySelector('.vjs-modal-dialog-content');
                    if (['视频文件损坏', '网络错误导致视频下载中途失败', '视频因格式不支持', '网络的问题无法加载'].some((s) => errorDiv === null || errorDiv === void 0 ? void 0 : errorDiv.innerText.includes(s))) {
                        background_1.$console.error('检测到视频加载失败，即将跳过视频。');
                        easy_us_1.$message.error('检测到视频加载失败，即将跳过视频。');
                        setTimeout(resolve, 3000);
                    }
                }, 3000);
                const playFunction = () => __awaiter(this, void 0, void 0, function* () {
                    // 这里先判断，再检测，否则后续添加多个 await 会导致视频启动等待时间过长，导致用户误认为脚本失效
                    if (hasFaceRecognition())
                        yield waitForFaceRecognition();
                    if (hasNewFaceRecognition())
                        yield waitForNewFaceRecognition();
                    if (media.ended === false) {
                        yield core_1.$.sleep(1000);
                        media.play();
                        media.playbackRate = playbackRate;
                    }
                });
                media.addEventListener('pause', playFunction);
                media.addEventListener('ended', () => {
                    media.removeEventListener('pause', playFunction);
                    background_1.$console.log('视频播放完毕');
                    clearInterval(reloadInterval);
                    resolve();
                });
                background_1.$console.log('视频开始播放');
                media.volume = volume;
                // 重置视频进度
                media.currentTime = 0;
                // 使用 setTimeout 解决 The play() request was interrupted by a call to pause() 问题
                setTimeout(() => {
                    (0, utils_1.playMedia)(() => media.play())
                        .then(() => {
                        media.playbackRate = playbackRate;
                    })
                        .catch(reject);
                }, 200);
            });
        });
    },
    /**
     * 阅读，PPT
     */
    read(win) {
        return __awaiter(this, void 0, void 0, function* () {
            const finishJob = win.finishJob;
            if (finishJob)
                finishJob();
            yield core_1.$.sleep(3000);
        });
    },
    /**
     * 时间阅读
     */
    timereader(iframe) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const src = ((_a = iframe.getAttribute('src')) === null || _a === void 0 ? void 0 : _a.toString()) || '';
            const timing = src ? parseInt(((_b = new URL(src).searchParams.get('timing')) === null || _b === void 0 ? void 0 : _b.toString()) || '60') : 60;
            easy_us_1.$message.info({
                content: `正在学习长时阅读任务，请稍等，不要切换..（预计${(timing + 3) * 3}秒）`,
                duration: (timing + 3) * 3
            });
            // 这里依靠 onactive 第一个跨域处理程序，等待处理后继续即可
            // 一共有三步，第一步等待timing，然后切换正文页，然后是封底页，最后点击一次PPT文档切换界面，即可完成任务
            yield core_1.$.sleep((timing + 3) * 3 * 1000);
            easy_us_1.$message.success('长时阅读任务完成！');
            yield core_1.$.sleep(5000);
        });
    },
    /**
     * 章节测验
     */
    chapter(frame, { answererWrappers, period, upload, thread, stopSecondWhenFinish, redundanceWordsText, answerSeparators }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (answererWrappers === undefined || answererWrappers.length === 0) {
                return (0, work_1.answerWrapperEmptyWarning)(0);
            }
            background_1.$console.info('开始章节测试');
            const visual_state = background_1.BackgroundProject.scripts.render.cfg.visual;
            const frameWindow = frame.contentWindow;
            const { TiMu } = (0, core_1.domSearchAll)({ TiMu: '.TiMu' }, frameWindow.document);
            // 最大化面板
            CORSUtils.panelNormal();
            common_1.CommonProject.scripts.workResults.methods.init();
            // 固定显示答题结果面板
            CORSUtils.pinWorkPanel();
            const chapterTestTaskQuestionTitleTransform = (titles) => {
                const images = [];
                const removed = (0, work_1.removeRedundantWords)(titles
                    .map((t) => {
                    if (!t)
                        return '';
                    const extracted = (0, work_1.extractTextWithImages)(t);
                    images.push(...extracted.images);
                    return extracted.text;
                })
                    .join(','), redundanceWordsText.split('\n'));
                const text = removed
                    .trim()
                    /** 超星旧版作业题目冗余数据 */
                    .replace(/^\d+[。、.]/, '')
                    .replace(/（\d+\.\d+分）/, '')
                    .replace(/\(..题, \d+?分\)/, '')
                    .replace(/\(..题, \d+\.\d+分\)/, '')
                    .replace(/[[(【（](..题|名词解释|完形填空|阅读理解)[\])】）]/, '')
                    .trim();
                return { text, images };
            };
            /** 仅供 simplifyWorkResult 等只需文本的调用方使用 */
            const chapterTestTaskQuestionTitleText = (titles) => chapterTestTaskQuestionTitleTransform(titles).text;
            /** 新建答题器 */
            const worker = new core_1.OCSWorker({
                root: TiMu,
                elements: {
                    title: [
                        (root) => (0, easy_us_1.$el)('.Zy_TItle .clearfix', root),
                        // /** 连线题第一组 */
                        (root) => (0, easy_us_1.$el)('.firstUlList', root),
                        // /** 连线题第二组 */
                        (root) => (0, easy_us_1.$el)('.secondUlList', root)
                    ],
                    /**
                     * 兼容各种选项
                     *
                     * ul li .after 单选多选
                     * ul li label:not(.after) 判断题
                     * ul li textarea 填空题
                     */
                    options: 'ul li .after,ul li textarea,ul textarea,ul li label:not(.before)',
                    type: 'input[id^="answertype"]',
                    lineSelectBox: '.thirdUlList .dept_select'
                },
                thread: thread !== null && thread !== void 0 ? thread : 1,
                answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
                /** 默认搜题方法构造器 */
                answerer: (0, work_1.createCommonAnswerer)({
                    titleTransform: (elements, ctx) => chapterTestTaskQuestionTitleTransform(elements.title),
                    optionsTransform: (elements, ctx) => {
                        var _a, _b;
                        const typeInput = (_a = elements.type) === null || _a === void 0 ? void 0 : _a[0];
                        const type = (typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined) || 'unknown';
                        ctx.type = type;
                        if (type === 'completion')
                            return '';
                        const optResults = ((_b = ctx.elements.options) !== null && _b !== void 0 ? _b : []).filter(Boolean).map((o) => (0, work_1.extractTextWithImages)(o));
                        return { text: optResults.map((r) => r.text).join('\n'), images: optResults.flatMap((r) => r.images) };
                    },
                    answererWrappers,
                    period
                }),
                work: (ctx) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const { elements, searchInfos } = ctx;
                    const typeInput = elements.type[0];
                    const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
                    if (type && (type === 'completion' || type === 'multiple' || type === 'judgement' || type === 'single')) {
                        const resolver = (0, core_1.createDefaultQuestionResolver)(ctx, (o) => (0, work_1.extractTextWithImages)(o).text)[type];
                        const handler = (type, answer, option, ctx) => {
                            var _a, _b, _c, _d, _e, _f, _g;
                            if (type === 'judgement' || type === 'single' || type === 'multiple') {
                                // 检查是否已经选择
                                const checked = ((_b = (_a = option === null || option === void 0 ? void 0 : option.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('label input')) === null || _b === void 0 ? void 0 : _b.getAttribute('checked')) === 'checked' ||
                                    // 适配2023/9月最新版本
                                    ((_c = option === null || option === void 0 ? void 0 : option.parentElement) === null || _c === void 0 ? void 0 : _c.getAttribute('aria-checked')) === 'true';
                                if (checked) {
                                    // 跳过
                                }
                                else {
                                    option === null || option === void 0 ? void 0 : option.click();
                                }
                            }
                            else if (type === 'completion' && answer.trim()) {
                                const text = (_d = option === null || option === void 0 ? void 0 : option.parentElement) === null || _d === void 0 ? void 0 : _d.querySelector('textarea');
                                const textareaFrame = (_e = option === null || option === void 0 ? void 0 : option.parentElement) === null || _e === void 0 ? void 0 : _e.querySelector('iframe');
                                if (text) {
                                    text.value = answer;
                                }
                                if (textareaFrame === null || textareaFrame === void 0 ? void 0 : textareaFrame.contentDocument) {
                                    textareaFrame.contentDocument.body.innerHTML = answer;
                                }
                                if ((_f = option === null || option === void 0 ? void 0 : option.parentElement) === null || _f === void 0 ? void 0 : _f.parentElement) {
                                    /** 如果存在保存按钮则点击 */
                                    (_g = (0, easy_us_1.$el)('[onclick*=saveQuestion]', option.parentElement.parentElement)) === null || _g === void 0 ? void 0 : _g.click();
                                }
                            }
                        };
                        return yield resolver(searchInfos, elements.options, handler);
                    }
                    // 连线题自定义处理
                    else if (type && type === 'line') {
                        const select = (el, opt_val) => {
                            const selected = el.querySelector(`option[selected]`);
                            const opt = el.querySelector(`option[value="${opt_val}"]`);
                            selected === null || selected === void 0 ? void 0 : selected.removeAttribute('selected');
                            if (opt) {
                                opt.setAttribute('selected', '');
                            }
                        };
                        for (const answers of searchInfos.map((info) => info.results.map((res) => res.answer))) {
                            for (const ans of answers) {
                                const splited_ans = (0, core_1.splitAnswer)(ans);
                                if (splited_ans.length !== 0 && elements.lineSelectBox.length === splited_ans.length) {
                                    //  选择答案
                                    for (let index = 0; index < elements.lineSelectBox.length; index++) {
                                        const box = elements.lineSelectBox[index];
                                        if (splited_ans[index]) {
                                            select(box, splited_ans[index]);
                                            const text = (_a = box.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.chosen-single span');
                                            if (text)
                                                text.textContent = splited_ans[index];
                                            yield core_1.$.sleep(200);
                                        }
                                    }
                                    return { finish: true };
                                }
                            }
                        }
                        return { finish: false };
                    }
                    return { finish: false };
                }),
                /** 完成答题后 */
                onResultsUpdate(curr, _, res) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    return __awaiter(this, void 0, void 0, function* () {
                        common_1.CommonProject.scripts.workResults.methods.setResults((0, work_1.simplifyWorkResult)(res, chapterTestTaskQuestionTitleText));
                        if ((_a = curr.result) === null || _a === void 0 ? void 0 : _a.finish) {
                            background_1.BackgroundProject.scripts.data.methods.addQuestionCacheFromWorkResult((0, work_1.simplifyWorkResult)([curr], chapterTestTaskQuestionTitleText));
                        }
                        common_1.CommonProject.scripts.workResults.methods.updateWorkStateByResults(res);
                        // 没有完成时随机作答
                        if (((_b = curr.result) === null || _b === void 0 ? void 0 : _b.finish) === false && curr.resolved === true) {
                            const options = ((_d = (_c = curr.ctx) === null || _c === void 0 ? void 0 : _c.elements) === null || _d === void 0 ? void 0 : _d.options) || [];
                            const typeInput = (_f = (_e = curr.ctx) === null || _e === void 0 ? void 0 : _e.elements) === null || _f === void 0 ? void 0 : _f.type[0];
                            const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
                            const commonSetting = common_1.CommonProject.scripts.settings.cfg;
                            if (commonSetting['randomWork-choice'] &&
                                (type === 'judgement' || type === 'single' || type === 'multiple')) {
                                background_1.$console.log('正在随机作答');
                                const option = options[Math.floor(Math.random() * options.length)];
                                // @ts-ignore 随机选择选项
                                (_h = (_g = option === null || option === void 0 ? void 0 : option.parentElement) === null || _g === void 0 ? void 0 : _g.querySelector('a,label')) === null || _h === void 0 ? void 0 : _h.click();
                            }
                            else if (commonSetting['randomWork-complete'] && type === 'completion') {
                                background_1.$console.log('正在随机作答');
                                // 随机填写答案
                                for (const option of options) {
                                    const textarea = (_j = option === null || option === void 0 ? void 0 : option.parentElement) === null || _j === void 0 ? void 0 : _j.querySelector('textarea');
                                    const completeTexts = commonSetting['randomWork-completeTexts-textarea'].split('\n').filter(Boolean);
                                    const text = completeTexts[Math.floor(Math.random() * completeTexts.length)];
                                    const textareaFrame = (_k = option === null || option === void 0 ? void 0 : option.parentElement) === null || _k === void 0 ? void 0 : _k.querySelector('iframe');
                                    if (text) {
                                        if (textarea) {
                                            textarea.value = text;
                                        }
                                        if (textareaFrame === null || textareaFrame === void 0 ? void 0 : textareaFrame.contentDocument) {
                                            textareaFrame.contentDocument.body.innerHTML = text;
                                        }
                                    }
                                    else {
                                        background_1.$console.error('请设置随机填空的文案');
                                    }
                                    yield core_1.$.sleep(500);
                                }
                            }
                        }
                    });
                },
                onElementSearched(elements) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const typeInput = elements.type[0];
                        const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
                        /** 判断题转换成文字，以便于答题程序判断 */
                        if (type === 'judgement') {
                            elements.options.forEach((option) => {
                                var _a;
                                const opt = ((_a = option === null || option === void 0 ? void 0 : option.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                if (opt.includes('对') || opt.includes('错')) {
                                    // 2023/8/5日后超星已修复判断题，将图片修改成文字，如果已经有对错的文本，则不需要再转换
                                }
                                // 如果是英语的对错题目，他是一个英文单词 True,False
                                else if (opt === 'True') {
                                    option.textContent = '√';
                                }
                                else if (opt === 'False') {
                                    option.textContent = 'x';
                                }
                                // 支持香港地区的繁体字
                                else if (opt === '對') {
                                    option.textContent = '√';
                                }
                                else if (opt === '錯') {
                                    option.textContent = 'x';
                                }
                                else {
                                    const ri = option.querySelector('.ri');
                                    const span = document.createElement('span');
                                    span.innerText = ri ? '√' : '×';
                                    option.appendChild(span);
                                }
                            });
                        }
                    });
                }
            });
            const results = yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
            const msg = `答题完成，将等待 ${stopSecondWhenFinish} 秒后进行保存或提交。`;
            background_1.$console.info(msg);
            easy_us_1.$message.info({ content: msg, duration: stopSecondWhenFinish });
            yield core_1.$.sleep(stopSecondWhenFinish * 1000);
            // 处理提交
            yield worker.uploadHandler({
                type: upload,
                results,
                callback(finishedRate, uploadable) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const msg = `完成率 ${finishedRate.toFixed(2)}% :  ${uploadable ? '3秒后将自动提交' : '3秒后将自动保存'} `;
                        background_1.$console.info(msg);
                        easy_us_1.$message.success({ content: msg, duration: 3 });
                        yield core_1.$.sleep(3000);
                        if (uploadable) {
                            // @ts-ignore 提交
                            frameWindow.btnBlueSubmit();
                            yield core_1.$.sleep(3000);
                            /** 确定按钮 */
                            // @ts-ignore 确定
                            frameWindow.submitCheckTimes();
                            // @ts-ignore 2024/4 更新后上方函数无法关闭弹窗，需要手动关闭确定弹窗
                            top.$('#workpop').hide();
                        }
                        else {
                            // @ts-ignore 禁止弹窗
                            frameWindow.alert = () => { };
                            // @ts-ignore 暂时保存
                            frameWindow.noSubmit();
                        }
                    });
                }
            });
            // 还原尺寸状态
            if (visual_state === 'minimize' && background_1.BackgroundProject.scripts.render.cfg.visual !== 'minimize') {
                CORSUtils.panelMinimize();
            }
            worker.emit('done');
        });
    },
    /**
     * 带音频的PPT
     */
    readPPTWithAudio(win) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // 关闭音视频声音
            win.document.querySelectorAll('audio').forEach((audio) => {
                audio.addEventListener('play', () => {
                    audio.muted = true;
                });
            });
            // 阅读PPT
            const len = win.document.querySelectorAll('.swiper-container .swiper-slide').length;
            for (let index = 0; index < len; index++) {
                (_a = win.swiperNext) === null || _a === void 0 ? void 0 : _a.call(win);
                yield core_1.$.sleep(1000);
            }
            yield core_1.$.sleep(3000);
        });
    },
    /**
     * 链接任务点
     */
    hyperlink(a) {
        return __awaiter(this, void 0, void 0, function* () {
            // 修改点击事件，防止出现弹窗
            const _click = a.onclick;
            a.onclick = () => false;
            // 点击完成
            a.click();
            // 还原点击事件
            a.onclick = _click;
            yield core_1.$.sleep(3000);
        });
    }
};
/**
 * cx 题目类型 ：
 * 0 单选题
 * 1 多选题
 * 2 简答题
 * 3 判断题
 * 4 填空题
 * 5 名词解释
 * 6 论述题
 * 7 计算题
 * 8 其他题(大概率是填空题)
 * 9 分录题
 * 10 资料题
 * 11 连线题
 * 14 完形填空
 * 15 阅读理解
 */
function getQuestionType(val) {
    return val === 0
        ? 'single'
        : val === 1
            ? 'multiple'
            : val === 3
                ? 'judgement'
                : [2, 4, 5, 6, 7, 8, 9, 10].some((t) => t === val)
                    ? 'completion'
                    : val === 11
                        ? 'line'
                        : val === 14
                            ? 'fill'
                            : val === 15
                                ? 'reader'
                                : undefined;
}
/** 阅读理解和完形填空的共同处理器 */
function readerAndFillHandle(searchInfos, list) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        for (const answers of searchInfos.map((info) => info.results.map((res) => res.answer))) {
            let ans = answers;
            if (ans.length === 1) {
                ans = (0, core_1.splitAnswer)(ans[0]);
            }
            if (ans.filter(Boolean).length !== 0 && list.length !== 0) {
                for (let index = 0; index < ans.length; index++) {
                    const item = list[index];
                    if (item) {
                        /** 获取每个小题中的准确答案选项 并点击 */
                        (_a = (0, easy_us_1.$el)(`span.saveSingleSelect[data="${ans[index]}"]`, item)) === null || _a === void 0 ? void 0 : _a.click();
                        yield core_1.$.sleep(200);
                    }
                }
                return { finish: true };
            }
        }
        return { finish: false };
    });
}
function hasFaceRecognition() {
    // 人脸元素有时候 src 属性为空字符串，所以这里需要判断 src 是否为空字符串，如是则人脸识别会出现。
    const faces = (0, easy_us_1.$$el)('#fcqrimg', top === null || top === void 0 ? void 0 : top.document);
    let active = false;
    for (const face of faces) {
        const src = face.getAttribute('src');
        if (src) {
            active = true;
            break;
        }
    }
    return active;
}
function hasNewFaceRecognition() {
    const faces = (0, easy_us_1.$$el)('.chapterVideoFaceMaskDiv', top === null || top === void 0 ? void 0 : top.document);
    let active = false;
    for (const face of faces) {
        if (face.style.display !== 'none') {
            active = true;
            break;
        }
    }
    return active;
}
/**
 * 等待新版人脸识别，视频开头会出现的人脸识别
 */
function waitForNewFaceRecognition() {
    let notified = false;
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            // 人脸元素有时候 src 属性为空字符串，所以这里需要判断 src 是否为空字符串，如是则人脸识别会出现。
            const active = hasNewFaceRecognition();
            if (active) {
                if (!notified) {
                    notified = true;
                    const msg = '检测到人脸识别，请手动进行识别后脚本才会继续运行。';
                    if (exports.CXProject.scripts.study.cfg.notifyWhenHasFaceRecognition) {
                        common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, { duration: 0 });
                    }
                    easy_us_1.$message.warn({ content: msg, duration: 0 });
                    background_1.$console.warn(msg);
                }
            }
            else {
                clearInterval(interval);
                resolve();
            }
        }, 3000);
    });
}
/**
 * 等待人脸识别
 */
function waitForFaceRecognition() {
    let notified = false;
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            // 人脸元素有时候 src 属性为空字符串，所以这里需要判断 src 是否为空字符串，如是则人脸识别会出现。
            const active = hasFaceRecognition();
            if (active) {
                if (!notified) {
                    notified = true;
                    const msg = '检测到人脸识别，请手动进行识别后脚本才会继续运行。';
                    if (exports.CXProject.scripts.study.cfg.notifyWhenHasFaceRecognition) {
                        common_1.CommonProject.scripts.settings.methods.notificationBySetting(msg, { duration: 0 });
                    }
                    easy_us_1.$message.warn({ content: msg, duration: 0 });
                    background_1.$console.warn(msg);
                }
            }
            else {
                clearInterval(interval);
                resolve();
            }
        }, 3000);
    });
}
/**
 * 答题程序位于其他 iframe 中，而 methods.pin 等 是依赖于 setTab 方法的，所以需要重新定义一个顶层函数来调用 pin 方法
 * 跨域调用
 */
const CORSUtils = {
    pinWorkPanel: easy_us_1.cors.defineTopFunction(() => {
        background_1.BackgroundProject.scripts.render.methods.pin(common_1.CommonProject.scripts.workResults);
    }),
    panelNormal: easy_us_1.cors.defineTopFunction(() => {
        background_1.BackgroundProject.scripts.render.methods.normal();
    }),
    panelMinimize: easy_us_1.cors.defineTopFunction(() => {
        background_1.BackgroundProject.scripts.render.methods.minimize();
    })
};
