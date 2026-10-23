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
exports.YKTProject = void 0;
const easy_us_1 = require("easy-us");
const core_1 = require("@ocsjs/core");
const utils_1 = require("../utils");
const ui_1 = require("../utils/ui");
const configs_1 = require("../utils/configs");
const study_1 = require("../utils/study");
const common_1 = require("./common");
const background_1 = require("./background");
const font_decrypt_1 = require("../utils/font-decrypt");
const work_1 = require("../utils/work");
const debounce_1 = __importDefault(require("lodash/debounce"));
/**
 * 雨课堂作业/考试字体解密用的参考特征表（FRB2 位打包格式，wght 250 字重特征）。
 * 由官方 Source Han Sans SC VF 默认实例（ExtraLight）离线生成
 * （生成脚本见 .codebuddy/font_analysis/export_frb2_tables.py），
 * 与平台加密方式无关，无需随平台改字体而更新。
 */
const YKT_EXAM_REF_TABLE_URL = 'https://cdn.ocsjs.com/resources/font/font_ref_yuketang.bin';
const state = {
    study: {
        currentMedia: undefined
    }
};
exports.YKTProject = easy_us_1.Project.create({
    name: '雨课堂',
    domains: ['yuketang.cn', 'gdufemooc.cn'],
    scripts: {
        guide: new easy_us_1.Script({
            name: '💡 使用提示',
            matches: [
                ['雨课堂课程列表', '/v2/web/index'],
                ['学习内容界面', '/v2/web/studentLog'],
                ['长江雨课堂手机版主页', '/m/v2/course/normalcourse/logs']
            ],
            namespace: 'yuketang.study.guide',
            configs: {
                notes: {
                    defaultValue: (0, ui_1.createSteps)(['登录网课平台', '点击课程中任意章节进入学习', '等待脚本自动运行']).outerHTML
                }
            },
            oncomplete(...args) {
                // 手机版，点击视频自动检测并跳转电脑版学习
                if (location.href.includes('/m/v2/course/normalcourse/logs')) {
                    easy_us_1.$message.info('请点击任意视频，进入自动学习。');
                }
            }
        }),
        global: new easy_us_1.Script({
            name: '全局脚本',
            matches: [['全部界面', /.*/]],
            hideInPanel: true,
            onstart(...args) {
                // 雨课堂反混淆，雨课堂修改了 attachShadow 方法
                // 这里重写removeChild方法，防止删除wrapper元素
                const _removeChild = Element.prototype.removeChild;
                Element.prototype.removeChild = function (e) {
                    if (e.nodeName === 'DIV') {
                        if (easy_us_1.$elements.wrapper && e === easy_us_1.$elements.wrapper) {
                            easy_us_1.$elements.wrapper.removeAttribute('style');
                            return e;
                        }
                    }
                    _removeChild.call(this, e);
                    return e;
                };
            }
        }),
        ppt: new easy_us_1.Script({
            name: '📚 PPT自动阅读',
            matches: [['PPT界面', /v2\/web\/studentCards\/.*\/ppt/]],
            hideInPanel: true,
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    // ===================================== PPT ==================================
                    easy_us_1.$message.info('正在学习PPT中，请耐心等待...');
                    for (const item of Array.from(document.querySelectorAll('.swiper-container .container')).filter((el) => !!el.querySelector('.noRead'))) {
                        yield easy_us_1.$.sleep(1000);
                        item.click();
                    }
                    easy_us_1.$message.info({ content: 'PPT阅读完毕，请手动切换到下一个任务', duration: 0 });
                });
            }
        }),
        /**
         * 旧版 v2/web 学习已废弃、目前大部分雨课堂主要为  ai-workspace， 其中存在区别： 部分 ai 课存在 AI学伴（右侧智能体功能）
         */
        ai: new easy_us_1.Script({
            name: '🖥️ 课程学习',
            matches: [
                ['学习中心', '/v2/web/index'],
                ['课程列表', '/v2/web/studentLog'],
                ['AI学伴课程界面', '/ai-workspace/lms-graph'],
                ['AI学伴课程界面手机版', '/ai-workspace/lms-graph-mobile']
            ],
            namespace: 'yuketang.study.ai',
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '请点击任意小节，脚本会自动运行，并自动下一节。',
                        '修改音量、倍速后请刷新页面使设置生效。',
                        '课件/PPT 等任务请手动进入触发自动阅读',
                        ['遇到作业任务点时可自动搜题作答', '（需在 通用-全局设置 中配置题库）。']
                    ]).outerHTML
                },
                restudy: configs_1.restudy,
                problemWork: {
                    label: '作业自动答题',
                    attrs: { type: 'checkbox', title: '遇到作业任务点时自动搜题作答并按设置提交（需配置题库）' },
                    defaultValue: true
                },
                discussMode: {
                    label: '讨论任务模式',
                    tag: 'select',
                    defaultValue: 'random',
                    options: [
                        ['random', '随机采用他人评论'],
                        ['first', '采用第一条评论'],
                        ['none', '不评论']
                    ]
                },
                volume: configs_1.volume,
                playbackRate: {
                    label: '视频倍速',
                    tag: 'select',
                    defaultValue: 1,
                    options: [
                        ['1', '1 x'],
                        ['1.25', '1.25 x'],
                        ['1.5', '1.5 x'],
                        ['2.0', '2.0 x']
                    ]
                }
            },
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (location.href.includes('ai-workspace/lms-graph-mobile')) {
                        easy_us_1.$message.warn('即将切换到电脑版AI课程...');
                        yield easy_us_1.$.sleep(3000);
                        location.href = location.href.replace('lms-graph-mobile', 'lms-graph');
                        return;
                    }
                    if (location.href.includes('/v2/web/index') || location.href.includes('/v2/web/studentLog')) {
                        background_1.BackgroundProject.scripts.render.methods.pin(this);
                        easy_us_1.$message.info('请手动进入到任意章节开始自动学习。');
                        return;
                    }
                    // 监听音量
                    this.onConfigChange('volume', (0, debounce_1.default)(() => easy_us_1.$message.info('音量设置已修改，刷新页面后生效'), 200));
                    // 监听速度
                    this.onConfigChange('playbackRate', (0, debounce_1.default)(() => easy_us_1.$message.info('倍速设置已修改，刷新页面后生效'), 200));
                    const getJobs = () => Array.from(document.querySelectorAll('div.leaf-item'));
                    const getJobName = () => { var _a; return ((_a = document.querySelector('.leaf-item.is-active .leaf-item-title')) === null || _a === void 0 ? void 0 : _a.textContent) || '未知任务点'; };
                    const getJobTag = (el) => { var _a; return (((_a = el.querySelector('.leaf-item-tag')) === null || _a === void 0 ? void 0 : _a.textContent) || '').trim(); };
                    const getNextJob = () => {
                        const jobs = getJobs();
                        const active_index = jobs.findIndex((job) => job.classList.contains('is-active'));
                        return jobs.find((job, i) => {
                            const tag_text = getJobTag(job);
                            const support = ['视频', '作业', '讨论', '图文'].includes(tag_text.trim());
                            const finished = job.querySelector('[class*=yuanquangou]');
                            return i > active_index && support && (this.cfg.restudy || !finished);
                        });
                    };
                    try {
                        easy_us_1.$message.info('等待任务加载中...');
                        yield (0, study_1.waitForElement)('.detail-container', {
                            timeout_seconds: 10 * 1000
                        });
                        yield easy_us_1.$.sleep(3000);
                    }
                    catch (e) {
                        easy_us_1.$message.error('元素加载失败，请刷新界面重试。');
                    }
                    // 现在界面会自动展开，无需手动展开章节，下列代码已废弃
                    // 展开5次章节，确保所有章节都被展开
                    const max_level = 5;
                    for (let i = 0; i < max_level; i++) {
                        document.querySelectorAll('.nav-item-title:not(.is-expand )').forEach((el) => el.click());
                        yield easy_us_1.$.sleep(100);
                    }
                    const study = () => __awaiter(this, void 0, void 0, function* () {
                        try {
                            if ((0, easy_us_1.$el)('.detail-container video')) {
                                utils_1.$msg.info('即将开始视频学习：' + getJobName());
                                yield watch({
                                    volume: this.cfg.volume,
                                    playbackRate: this.cfg.playbackRate
                                });
                                yield easy_us_1.$.sleep(3000);
                            }
                            const forum = (0, easy_us_1.$el)('.detail-container .lms-graph-forum');
                            if (forum) {
                                utils_1.$msg.info('即将开始自动讨论：' + getJobName());
                                // 评论模式复用「课程学习」脚本的 discussMode 设置
                                yield autoCommentYktForum(forum, this.cfg.discussMode);
                                utils_1.$msg.success('自动讨论完成');
                                yield easy_us_1.$.sleep(3000);
                            }
                            if ((0, easy_us_1.$el)('.detail-container .lms-graph-exercise')) {
                                // 作业任务点：题目在 iframe（#iframeExerciseId -> /v2/web/iframe-exercise）内，
                                // 与主页面同源，可通过 contentDocument 访问
                                if (this.cfg.problemWork) {
                                    const exerciseIframe = (0, easy_us_1.$el)('.detail-container .lms-graph-exercise iframe#iframeExerciseId');
                                    if (!exerciseIframe) {
                                        background_1.$console.warn('作业任务点结构未识别（缺少 iframe#iframeExerciseId），跳过自动答题。');
                                    }
                                    else if (!exerciseIframe.contentDocument) {
                                        background_1.$console.warn('作业 iframe 无法访问（可能跨域），跳过自动答题。');
                                    }
                                    else {
                                        easy_us_1.$message.info('检测到作业任务点，等待作业页面加载...');
                                        // 等 iframe 内题目区域渲染（waitForElement 超时单位：秒，超时时 resolve undefined）
                                        const questionRoot = yield (0, study_1.waitForElement)(() => { var _a; return (_a = exerciseIframe.contentDocument) === null || _a === void 0 ? void 0 : _a.querySelector('.container-problem .subject-item'); }, { timeout_seconds: 20, check_period_ms: 200 });
                                        if (!questionRoot) {
                                            background_1.$console.warn('作业页面加载超时，跳过自动答题。');
                                        }
                                        else {
                                            // 题库检查/开始倒计时/控制面板由 commonWork 统一处理
                                            yield new Promise((resolve) => {
                                                (0, work_1.commonWork)(this, {
                                                    workerProvider: (opts) => {
                                                        return createYktEmbeddedWorkLoop(opts, exerciseIframe.contentDocument, () => resolve());
                                                    }
                                                });
                                            });
                                            easy_us_1.$message.success('作业任务点答题完成。');
                                        }
                                    }
                                }
                                yield easy_us_1.$.sleep(3000);
                            }
                        }
                        catch (e) {
                            background_1.$console.error(`当前任务点无法完成，即将跳转下一节（${e}）`);
                            easy_us_1.$message.error(`当前任务点无法完成，即将跳转下一节（${e}）`);
                        }
                        const next = getNextJob();
                        if (!next) {
                            return easy_us_1.$modal.alert({
                                content: '检测到当前视频全部播放完毕，如果还有未完成的视频请刷新重试，或者打开复习模式。'
                            });
                        }
                        next.click();
                        yield easy_us_1.$.sleep(200);
                        next.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        yield easy_us_1.$.sleep(3000);
                        study();
                    });
                    study();
                });
            }
        })
    }
});
/**
 * AI学伴讨论任务点自动评论。
 * 结构依据样本 .codebuddy/yuketan_work/forum.html：
 *   评论列表：.forum-content .forum-item .comment-text
 *   输入框：  .forum-publish textarea.el-textarea__inner
 *   发送按钮：.prompt-send-btn（div；输入为空时带 .disabled，填充后由 Vue 移除，需等待解除禁用再点击）
 *   发言状态：.learning-space-control-unit .control-right .f12（已发言则跳过，防止重复评论）
 * 失败统一抛出错误，由调用方（study 循环）捕获并跳转下一节。
 */
function autoCommentYktForum(forum, discussMode) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // 防止重复评论：检测发言状态（未发言/已发言）
        const speakStatus = (_b = (_a = forum.querySelector('.learning-space-control-unit .control-right .f12')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim();
        if (speakStatus === null || speakStatus === void 0 ? void 0 : speakStatus.includes('已发言')) {
            easy_us_1.$message.info('当前讨论已发言，跳过评论步骤。');
            return;
        }
        if (discussMode === 'none') {
            easy_us_1.$message.info('已设置为不进行评论，跳过评论步骤。');
            return;
        }
        // 等待输入框渲染（waitForElement 超时 resolve undefined）
        const textarea = (yield (0, study_1.waitForElement)(() => forum.querySelector('.forum-publish textarea.el-textarea__inner'), { timeout_seconds: 20, check_period_ms: 500 }));
        if (!textarea) {
            throw new Error('讨论区输入框加载超时。');
        }
        const discusses = Array.from(forum.querySelectorAll('.forum-content .forum-item .comment-text'))
            .map((el) => (el.textContent || '').trim())
            .filter(Boolean);
        if (discusses.length === 0) {
            throw new Error('讨论区暂无评论可参考，无法自动评论。');
        }
        const content = discussMode === 'first' ? discusses[0] : discusses[Math.floor(Math.random() * discusses.length)];
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        // 填充后等待发送按钮解除禁用（.disabled 状态下点击无效）
        const send_btn = yield (0, study_1.waitForElement)(() => forum.querySelector('.prompt-send-btn:not(.disabled)'), {
            timeout_seconds: 10,
            check_period_ms: 500
        });
        if (!send_btn) {
            throw new Error('讨论区发送按钮未解除禁用，评论提交失败。');
        }
        send_btn.click();
        yield easy_us_1.$.sleep(1000);
    });
}
/** 雨课堂加密文字元素选择器（平台统一用此类标记密文） */
const YKT_ENCRYPTED_SELECTOR = '.xuetangx-com-encrypted-font';
/**
 * 各字体的解密器实例（懒创建）。
 * 以字体源（URL）为 key：同一字体映射表终身缓存复用；
 * SPA 切换到新作业/考试下发了新字体文件时，新 URL 会创建新的解密器，
 * 避免旧映射表误用到新置换字体上。
 */
const fontDecryptors = new Map();
/** 页面动态内容监听器（SPA 路由切换时先 stop 再重建） */
let fontWatchController;
/**
 * 雨课堂作业/考试界面加密字体动态解密。
 *
 * 加密原理：页面下发的 exam_font_*.ttf 是 SourceHanSansSC-VF 的子集，
 * 字体中码点 X 的字形轮廓实际画的是另一个字（每次下发的置换表不同），
 * 因此"静态映射表"方案不可行，必须对当前页面的字体实时破解。
 *
 * 动态场景：题目默认隐藏，点击题号才渲染题目内容。本实现通过
 * watchElements 监听 DOM 变化，新出现的加密文字自动增量解密——
 * 同一字体的映射表只完整破解一次并常驻内存，切题时只需破解
 * 新出现的少量字符（通常 0~10 字，毫秒级完成）。
 *
 * @see 算法详解见 utils/font-decrypt/bitmap.ts 文件头注释
 */
function setupYuketangFontDecrypt(doc = document) {
    return __awaiter(this, void 0, void 0, function* () {
        // 停止上一次页面（SPA 路由切换）遗留的监听器，避免重复解密
        fontWatchController === null || fontWatchController === void 0 ? void 0 : fontWatchController.stop();
        fontWatchController = undefined;
        const dec_msg = easy_us_1.$message.info({ content: '字体解密中...', duration: 0 });
        // 尝试等待加密文字元素渲染（SPA 异步加载）；超时也不返回——
        // 监听器会在加密文字后续出现时自动解密（如从其他页面 SPA 跳转进来）
        // 注意：不能用 waitForElement——它写死全局 document，而加密文字可能在
        // iframe 的 document 里（会白等整个超时）。这里按 doc 短轮询，即时命中。
        const waitStart = Date.now();
        while (!doc.querySelector(YKT_ENCRYPTED_SELECTOR) && Date.now() - waitStart < 3000) {
            yield easy_us_1.$.sleep(200);
        }
        if (!doc.querySelector(YKT_ENCRYPTED_SELECTOR)) {
            background_1.$console.log('暂未检测到加密文字，将持续监听页面变化。');
        }
        let firstDecrypt = true;
        const decryptEls = (els) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // 只处理仍带加密标记的元素，并在任何异步操作【之前】改标为"解密中"：
            // 并发的重复调用（监听器/主动解密）会把这些元素过滤掉，
            // 否则【已解密的明文】会被再次过映射表（双重解密必然产生乱码）
            els = els.filter((el) => el.classList.contains('xuetangx-com-encrypted-font'));
            if (els.length === 0) {
                return;
            }
            for (const el of els) {
                el.classList.remove('xuetangx-com-encrypted-font');
                el.classList.add('xuetangx-com-font-decrypting');
            }
            // 解密失败的元素做失败标记（fail-open）：
            // 文字按原样（密文）保留，避免残留导致就绪判定每题白等超时
            const markFailed = (groupEls) => {
                for (const el of groupEls) {
                    el.classList.remove('xuetangx-com-font-decrypting');
                    el.classList.add('xuetangx-com-font-decrypt-failed');
                }
            };
            // 字体源在每次解密时重新解析（惰性）：SPA 切换到新作业/考试时
            // 平台会下发新字体文件，不能使用初始化时缓存的旧 URL。
            // 雨课堂加密字体 URL 特征：fe_font/product/exam_font_*.ttf
            const findExamFontUrl = () => {
                const faces = (0, font_decrypt_1.listFontFaces)(doc);
                // 1. @font-face 规则（族名含 exam/decrypt，或 src 匹配考试字体特征）
                const face = faces.find((f) => /exam|decrypt/i.test(f.family) || /exam_font|fe_font/.test(f.src));
                if (face) {
                    return face.src;
                }
                // 2. 资源加载记录（findFontUrls 已改为读取目标 document 所属 window 的 performance）
                return (0, font_decrypt_1.findFontUrls)(doc).find((u) => /exam_font|fe_font/.test(u));
            };
            // 考试字体可能晚于密文元素加载（@font-face 动态注入、字体文件异步请求），
            // 必须等待重试；绝不能 fallback 到其他字体——用错误字体破解出的
            // 垃圾映射比不解密更糟（密文被置换成另一套乱码且难以察觉）
            let examFontUrl = findExamFontUrl();
            const fontWaitStart = Date.now();
            while (!examFontUrl && Date.now() - fontWaitStart < 10000) {
                yield easy_us_1.$.sleep(300);
                examFontUrl = findExamFontUrl();
            }
            if (!examFontUrl) {
                background_1.$console.warn(`[font-decrypt] 等待考试字体超时（@font-face=[${(0, font_decrypt_1.listFontFaces)(doc)
                    .map((f) => f.family)
                    .join(', ')}], 字体文件=[${(0, font_decrypt_1.findFontUrls)(doc).join(', ')}]），跳过解密。`);
                markFailed(els);
                return;
            }
            // 字体族匹配不到 @font-face 时，fallback 只允许使用考试字体
            const resolveFontSource = (family) => {
                var _a, _b;
                const faces = (0, font_decrypt_1.listFontFaces)(doc);
                return (_b = (_a = faces.find((f) => family.includes(f.family) || f.family.includes(family))) === null || _a === void 0 ? void 0 : _a.src) !== null && _b !== void 0 ? _b : examFontUrl;
            };
            // 按元素实际使用的 font-family 分组（可能一页多个置换字体）
            const groups = new Map();
            for (const el of els) {
                // 元素可能位于 iframe 内，必须用其所属 document 的 window 取计算样式
                const view = (_a = el.ownerDocument.defaultView) !== null && _a !== void 0 ? _a : window;
                const family = (view.getComputedStyle(el).fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
                const group = (_b = groups.get(family)) !== null && _b !== void 0 ? _b : [];
                group.push(el);
                groups.set(family, group);
            }
            for (const [family, groupEls] of groups) {
                const fontSource = resolveFontSource(family);
                if (!fontSource) {
                    background_1.$console.warn(`[font-decrypt] 未找到字体 ${family} 对应的字体文件，跳过解密。`);
                    markFailed(groupEls);
                    continue;
                }
                try {
                    let decryptor = fontDecryptors.get(fontSource);
                    if (!decryptor) {
                        decryptor = yield font_decrypt_1.FontDecryptor.create(fontSource, {
                            refTableUrl: YKT_EXAM_REF_TABLE_URL,
                            // 雨课堂加密字体是可变字体（wght 250-900），必须锁定为特征表对应的默认实例字重
                            fontWeight: '250'
                        });
                        fontDecryptors.set(fontSource, decryptor);
                    }
                    yield decryptor.decrypt(groupEls);
                    // 解密后必须移除加密字体类：元素文本已还原为明文，
                    // 继续用加密字体渲染会显示成错误的字形
                    for (const el of groupEls) {
                        el.classList.remove('xuetangx-com-font-decrypting');
                        el.classList.add('xuetangx-com-font-decrypted');
                    }
                    if (firstDecrypt) {
                        firstDecrypt = false;
                        if (dec_msg)
                            dec_msg.textContent = '字体解密完成，切换题目时将自动解密新内容。';
                    }
                }
                catch (err) {
                    background_1.$console.error(`[font-decrypt] 字体 ${family} 解密失败：`, String(err));
                    markFailed(groupEls);
                }
            }
            setTimeout(() => {
                dec_msg === null || dec_msg === void 0 ? void 0 : dec_msg.remove();
            }, 3000);
        });
        // 当前文档的解密处理器（供主动解密调用）
        activeDecryptHandler = decryptEls;
        // 监听 DOM：初始内容 + 题目切换等动态渲染出的加密文字自动增量解密
        fontWatchController = (0, font_decrypt_1.watchElements)(doc, YKT_ENCRYPTED_SELECTOR, (found) => enqueueYktDecrypt(found));
        background_1.$console.log('字体动态解密已启动。');
    });
}
/** 当前文档的解密处理器（由 setupYuketangFontDecrypt 设置） */
let activeDecryptHandler;
/** 解密调用串行队列（监听器与主动解密共用，防止并发重复解密） */
let decryptChain = Promise.resolve();
/** 将一批元素送入解密串行队列（元素级去重在处理器内部完成） */
function enqueueYktDecrypt(els) {
    const run = decryptChain.then(() => activeDecryptHandler === null || activeDecryptHandler === void 0 ? void 0 : activeDecryptHandler(els));
    decryptChain = run.then(() => undefined, () => undefined);
    return run;
}
/**
 * 【API】立即解密 doc 中所有当前密文元素并等待完成。
 *
 * 答题程序读题前必须调用：不依赖监听器防抖/时序，直接同步触发解密，
 * 返回时 DOM 文本已稳定为明文（解密失败的元素按原样保留密文）。
 */
function decryptYktNow(doc) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureYktFontDecrypt(doc);
        const els = Array.from(doc.querySelectorAll(YKT_ENCRYPTED_SELECTOR));
        if (els.length) {
            yield enqueueYktDecrypt(els);
        }
        // 等所有已排队的解密（包括监听器触发的）完成
        yield decryptChain;
    });
}
let fontDecryptSetupPromise;
/** 当前监听器绑定的 document（iframe 切换后 contentDocument 会变，需重新安装） */
let fontDecryptSetupDoc;
/**
 * 确保字体动态解密已启动（按 document 幂等）。
 * 字体解密脚本（可由用户关闭）和答题程序（读题前必须有明文）共用此入口。
 * 注意：AI学伴流程中每个作业任务点都是新 iframe（新 contentDocument），
 * doc 变化时必须重新安装监听器，否则新页面的密文永远不会被解密。
 */
function ensureYktFontDecrypt(doc = document) {
    if (!fontDecryptSetupPromise || fontDecryptSetupDoc !== doc) {
        fontDecryptSetupDoc = doc;
        fontDecryptSetupPromise = setupYuketangFontDecrypt(doc).catch((err) => {
            // 失败允许下次重试
            fontDecryptSetupPromise = undefined;
            fontDecryptSetupDoc = undefined;
            throw err;
        });
    }
    return fontDecryptSetupPromise;
}
/**
 * 从 .item-type 文本解析题型（如 "4.单选题(1分)"）。
 * 填空/简答统一按 completion 处理（无选项，逐空填写）。
 */
function parseYktQuestionType(typeText) {
    if (typeText.includes('单选')) {
        return 'single';
    }
    if (typeText.includes('多选')) {
        return 'multiple';
    }
    if (typeText.includes('判断')) {
        return 'judgement';
    }
    // 填空/简答/问答/主观题统一按 completion 处理（无选项，直接填充答案）
    if (typeText.includes('填空') ||
        typeText.includes('简答') ||
        typeText.includes('问答') ||
        typeText.includes('主观')) {
        return 'completion';
    }
    return undefined;
}
/** 当前激活题目的标识（题号+题型，如 "4.单选题(1分)"），用于检测切题与防死循环 */
function currentYktQuestionMarker(doc) {
    var _a, _b, _c;
    return (_c = (_b = (_a = doc.querySelector('.container-problem .subject-item .item-type')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.replace(/\s+/g, '')) !== null && _c !== void 0 ? _c : '';
}
/**
 * 填充主观题的 UEditor 富文本编辑器。
 *
 * 优先使用页面 UEditor API（`UE.getEditor(容器id).setContent`，
 * 会触发 contentchange 使"提交"按钮解除禁用）；API 不可用时
 * 直接写入编辑器 iframe 的 body 并派发 input 事件兜底。
 */
function fillYktUEditor(iframe, answer) {
    var _a, _b, _c;
    // 纯文本答案转义为安全 HTML（按换行分段）
    const html = '<p>' +
        answer.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, '</p><p>') +
        '</p>';
    // UEditor 容器 id 形如 ueditor-<rand>（注意与 iframe 的 ueditor_<n> 下划线区分）
    const containerId = (_a = iframe.closest('[id^="ueditor-"]')) === null || _a === void 0 ? void 0 : _a.id;
    const ue = (_b = iframe.ownerDocument.defaultView) === null || _b === void 0 ? void 0 : _b.UE;
    if (containerId && ue) {
        try {
            const editor = ue.getEditor(containerId);
            // ready(fn)：编辑器未初始化完成时会延迟执行
            editor.ready(() => editor.setContent(html));
            return;
        }
        catch (err) {
            background_1.$console.warn('[answer] UEditor API 填充失败，尝试直接写入：', String(err));
        }
    }
    const body = (_c = iframe.contentDocument) === null || _c === void 0 ? void 0 : _c.body;
    if (body) {
        body.innerHTML = html;
        body.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
/**
 * 提交当前题目的答案。
 * 雨课堂平台切换题目不会自动保存答案，必须每题作答后立即点击"提交"。
 * 返回是否成功发起提交（按钮不可用说明本题无可提交内容）。
 */
function submitYktCurrentQuestion(doc, order) {
    return __awaiter(this, void 0, void 0, function* () {
        /** 本题在导航中是否已出现完成标记（提交成功的可靠信号）。
         *  注意必须用题号定位：提交成功后平台会自动切到下一题，active 已变化。
         *  选择题等显示 .icon-status 图标；主观题提交后显示"未批改"文本状态（无图标）。 */
        const hasStatusMark = () => {
            var _a, _b;
            const item = doc.querySelector(`.problems-aside .subject-item.J_order[data-order="${order}"]`);
            return (!!(item === null || item === void 0 ? void 0 : item.querySelector('.icon-status')) || !!((_b = (_a = item === null || item === void 0 ? void 0 : item.querySelector('.text-status')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes('未批改')));
        };
        // 实测发现偶发"点击提交但未生效"（按钮恢复可用但无完成标记），需要重试
        for (let attempt = 0; attempt < 2; attempt++) {
            // 提交按钮可能会出现额外文本，例如（剩余 x 次 提交）
            const submitBtn = Array.from(doc.querySelectorAll('.problem-box button.el-button--primary')).find((b) => { var _a; return ((_a = b.textContent) === null || _a === void 0 ? void 0 : _a.trim().includes('提交')) && !b.disabled && !b.classList.contains('is-disabled'); });
            if (!submitBtn) {
                // 按钮不可用：已提交成功（按钮变为"已提交"/禁用）或无答案可提交
                return attempt > 0 ? hasStatusMark() : false;
            }
            submitBtn.click();
            yield easy_us_1.$.sleep(1000);
            // 等待提交完成（以导航状态标记为准），超时进入重试判定
            const waitStart = Date.now();
            while (Date.now() - waitStart < 10000) {
                if (hasStatusMark()) {
                    return true;
                }
                yield easy_us_1.$.sleep(300);
            }
        }
        background_1.$console.error('未检测到完成状态。');
        return false;
    });
}
/**
 * 等待当前题目"可用"。就绪条件（需连续两次满足，防 Vue 分批渲染与解密竞态）：
 *   1. 题目标识已渲染（切题后 marker 变化）
 *   2. 正文 .problem-body 有非空文本（防止"题号先渲染、正文经 XHR 后到"时读到空/密文）
 *   3. 无残留密文/解密中的元素（解密通过 decryptYktNow 主动触发，不依赖监听器时序）
 * 超时后放行（降级处理）。
 */
function waitYktQuestionReady(prevMarker, doc, timeoutMs = 15000) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const start = Date.now();
        // 1. 等题目渲染：首题等 marker 出现；切题后等 marker 变化
        while (Date.now() - start < timeoutMs) {
            const marker = currentYktQuestionMarker(doc);
            if (marker && marker !== prevMarker) {
                break;
            }
            yield easy_us_1.$.sleep(200);
        }
        // 2. 等"正文已渲染且已解密"
        let stable = 0;
        while (Date.now() - start < timeoutMs) {
            // 主动解密当前密文并等待完成（幂等；无密文时立即返回）
            yield decryptYktNow(doc);
            const hasContent = !!((_b = (_a = doc.querySelector('.container-problem .problem-body')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim());
            const hasCipher = !!doc.querySelector(`.container-problem ${YKT_ENCRYPTED_SELECTOR}, .container-problem .xuetangx-com-font-decrypting`);
            if (hasContent && !hasCipher) {
                stable++;
                if (stable >= 2) {
                    return;
                }
            }
            else {
                stable = 0;
            }
            yield easy_us_1.$.sleep(200);
        }
        background_1.$console.warn(`[answer] 等待题目就绪超时（${timeoutMs}ms），将就绪状态降级继续。`);
    });
}
/**
 * 雨课堂作业答题 worker（逐题切换作答）。
 *
 * 页面特点：同一时刻 DOM 中只有当前一题（.container-problem .subject-item），
 * 通过点击"下一题"或左侧题号切换，内容为 Vue 动态渲染且文字可能被字体加密。
 *
 * 流程（参考 zhs.ts 校内学分课 xnkWork 的逐题作答模式）：
 *   确保字体解密启动 -> 等题目渲染+解密 -> 搜题作答 -> 点"下一题" -> 循环
 */
/** 横线填空题的答案输入框选择器（class 为主，placeholder 兜底） */
const YKT_BLANK_INPUT_SELECTOR = 'input.blank-item-dynamic, input[placeholder="输入答案"]';
/**
 * 提取题干文本：横线填空题的答案输入框（placeholder="输入答案"）无文本内容，
 * 提取时会"消失"导致题库无法识别这是填空题；
 * 这里先克隆元素并把每个横线输入框替换为 ____ 文本再提取，
 * 如 "…内容包括：____、____、____、____。"
 */
function extractYktTitleText(el) {
    if (!el.querySelector(YKT_BLANK_INPUT_SELECTOR)) {
        return (0, work_1.extractTextWithImages)(el).text;
    }
    const clone = el.cloneNode(true);
    for (const input of Array.from(clone.querySelectorAll(YKT_BLANK_INPUT_SELECTOR))) {
        input.replaceWith('____');
    }
    return (0, work_1.extractTextWithImages)(clone).text;
}
function createYktAnswerWorker({ answererWrappers, period, thread, redundanceWordsText, answerSeparators }) {
    const redundanceWords = redundanceWordsText.split('\n').filter(Boolean);
    const titleTransform = (titles) => titles
        .filter((t) => t === null || t === void 0 ? void 0 : t.innerText)
        .map((t) => t
        ? (0, work_1.removeRedundantWords)(core_1.StringUtils.of(extractYktTitleText(t)).nowrap(' ').nospace().toString().trim(), redundanceWords)
        : '')
        .join(',');
    /** 选项文本：取选项内容部分（去掉 A/B/C/D 字母与勾选框） */
    const optionText = (option) => {
        var _a;
        // 判断题选项为 √/× 图标（无文本，input value="true/false"），
        // 用 value 合成文本供默认答案解析器匹配（对/错词表）
        const input = option.querySelector('input');
        if ((input === null || input === void 0 ? void 0 : input.value) === 'true') {
            return '对';
        }
        if ((input === null || input === void 0 ? void 0 : input.value) === 'false') {
            return '错';
        }
        const textEl = option.querySelector('.radioText, .checkboxText');
        return (0, work_1.extractTextWithImages)((_a = textEl) !== null && _a !== void 0 ? _a : option).text;
    };
    let totalQuestionCount = 0;
    let requestedCount = 0;
    let resolvedCount = 0;
    // OCSWorker 的 root 传字符串时会在【全局 document】上查询，
    // 而雨课堂作业在 iframe 内（AI学伴课程页内嵌 iframe-exercise），
    // 必须传元素数组；doWork 每次调用都会重新读取 root，
    // 因此数组内容由 runYktAnswerLoop 在每次作答前从目标 document 实时刷新。
    const questionRootRef = [];
    const worker = new core_1.OCSWorker({
        // 当前激活题目的容器（注意与左侧导航 .problems-aside 中的同名 .subject-item 区分）
        root: questionRootRef,
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
            // 题干：选择题/主观题为 .problem-body；填空题的题干与空格输入框混排在
            // .item-body 的第一个 div 中（无 .problem-body），取该容器兜底
            title: (root) => {
                const pb = (0, easy_us_1.$$el)('.problem-body', root);
                return pb.length ? pb : (0, easy_us_1.$$el)('.item-body > div', root).slice(0, 1);
            },
            type: '.item-type',
            options: (root) => {
                // 选择题为选项 label（element-ui radio/checkbox）
                const labels = (0, easy_us_1.$$el)('ul[class*="list-unstyled"] li label', root);
                if (labels.length) {
                    return labels;
                }
                // 主观题为 UEditor 富文本编辑器（iframe 作为填充目标）；
                // 填空题为横线输入框（blank-item-dynamic / placeholder="输入答案"）；简答为原生 textarea
                const editors = (0, easy_us_1.$$el)('iframe[id^="ueditor_"]', root);
                if (editors.length) {
                    return editors;
                }
                const blanks = (0, easy_us_1.$$el)(YKT_BLANK_INPUT_SELECTOR, root);
                return blanks.length ? blanks : (0, easy_us_1.$$el)('textarea', root);
            }
        },
        thread: thread !== null && thread !== void 0 ? thread : 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        answerer: (0, work_1.createCommonAnswerer)({
            titleTransform: (elements) => titleTransform(elements.title),
            optionsTransform: (elements, ctx) => {
                var _a, _b, _c, _d;
                // 顺带解析题型写入上下文
                ctx.type = parseYktQuestionType((_c = (_b = (_a = elements.type) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.textContent) !== null && _c !== void 0 ? _c : '');
                if (ctx.type === 'completion') {
                    return '';
                }
                return ((_d = elements.options) !== null && _d !== void 0 ? _d : []).map((o) => optionText(o)).join('\n');
            },
            answererWrappers,
            period
        }),
        work: (ctx) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const type = (_b = (_a = ctx.type) !== null && _a !== void 0 ? _a : (0, core_1.defaultWorkTypeResolver)(ctx)) !== null && _b !== void 0 ? _b : 'single';
            const resolver = (0, core_1.createDefaultQuestionResolver)(ctx, (o) => optionText(o))[type];
            if (!resolver) {
                return { finish: false };
            }
            return yield resolver(ctx.searchInfos, ((_c = ctx.elements.options) !== null && _c !== void 0 ? _c : []), (t, answer, option) => __awaiter(this, void 0, void 0, function* () {
                var _d;
                if (t === 'judgement' || t === 'single' || t === 'multiple') {
                    // element-ui：is-checked / input.checked 表示已选中，避免重复点击导致取消选择
                    if (option &&
                        !option.classList.contains('is-checked') &&
                        ((_d = option.querySelector('input')) === null || _d === void 0 ? void 0 : _d.checked) !== true) {
                        option.click();
                        yield easy_us_1.$.sleep(300);
                    }
                }
                else if (t === 'completion' && answer.trim()) {
                    if ((option === null || option === void 0 ? void 0 : option.tagName) === 'IFRAME') {
                        // 主观题：UEditor 富文本编辑器
                        fillYktUEditor(option, answer);
                        yield easy_us_1.$.sleep(300);
                    }
                    else {
                        // 填空题为 input 文本框，简答为 textarea
                        const input = (option === null || option === void 0 ? void 0 : option.tagName) === 'TEXTAREA' || (option === null || option === void 0 ? void 0 : option.tagName) === 'INPUT'
                            ? option
                            : option === null || option === void 0 ? void 0 : option.querySelector('textarea,input');
                        if (input) {
                            input.value = answer;
                            // Vue 受控组件必须派发 input 事件才能同步数据
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            yield easy_us_1.$.sleep(200);
                        }
                    }
                }
            }));
        }),
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
    return { worker, questionRootRef };
}
/**
 * 逐题作答循环（独立作业页与 AI 学伴内嵌任务点共用）：
 * 作答当前题 -> 立即提交本题（平台切题不保存答案）-> 点击"下一题" -> 等待切换与解密 -> 继续。
 * 返回全部题目的作答结果与是否全部完成（用于结尾统计与提示）。
 *
 * @param questionRootRef 题目容器引用数组（doWork 每次调用都重新读取，
 *                        这里在每次作答前从 doc 实时刷新）
 * @param doc             题目所在的 document（作业在 iframe 内时为 iframe.contentDocument）
 */
/**
 * 等待平台风控验证码完成。
 *
 * 作业自动答题触发风控时页面出现 #homework-automation-risk-challenge 元素，
 * 必须由用户手动完成验证，否则无法继续自动答题。
 * 元素不存在时立即返回；存在则挂起直到用户完成验证（元素消失）。
 */
function waitYktCaptcha(doc) {
    return __awaiter(this, void 0, void 0, function* () {
        // 作业在 iframe 内，优先在 doc 中查找；兜底顶层 document
        const getCaptcha = () => doc.querySelector('#homework-automation-risk-challenge');
        if (!getCaptcha()) {
            return;
        }
        background_1.$console.warn('[answer] 检测到平台风控验证码，等待手动完成...');
        const message = easy_us_1.$message.warn({
            content: '检测到平台风控验证码，请手动完成验证，完成后将自动继续答题。',
            duration: 0
        });
        common_1.CommonProject.scripts.settings.methods.notificationBySetting('雨课堂脚本：检测到平台风控验证码，请手动完成验证，完成后将自动继续答题。', { duration: 0 });
        yield new Promise((resolve) => {
            const interval = setInterval(() => {
                if (!getCaptcha()) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
        message === null || message === void 0 ? void 0 : message.remove();
        easy_us_1.$message.success('验证码已完成，继续自动答题。');
    });
}
/**
 * 雨课堂的切换序号确认、如果有未保存的题目会出现弹窗，这里等待用户确认
 * 包括：批量未保存答案的提交、单题未保存答案提交
 */
function waitYktWorkConfirmDialog(doc) {
    return __awaiter(this, void 0, void 0, function* () {
        const getDialog = () => {
            const els = Array.from(doc.querySelectorAll('.homework-problem-change-guard-dialog,.homework-problem-batch-submit-dialog'));
            if (els.some((e) => { var _a; return ((_a = e === null || e === void 0 ? void 0 : e.parentElement) === null || _a === void 0 ? void 0 : _a.classList.contains('el-dialog__wrapper')) && (e === null || e === void 0 ? void 0 : e.parentElement.style.display) !== 'none'; })) {
                return true;
            }
        };
        if (!getDialog()) {
            return;
        }
        background_1.$console.warn('[answer] 检测到作业存在未保存答案，等待手动确认...');
        const message = easy_us_1.$message.warn({
            content: '检测到作业存在未保存答案，请手动确认 。',
            duration: 0
        });
        common_1.CommonProject.scripts.settings.methods.notificationBySetting('雨课堂脚本：检测到作业存在未保存答案，请手动确认 。', {
            duration: 0
        });
        yield new Promise((resolve) => {
            const interval = setInterval(() => {
                if (!getDialog()) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
        message === null || message === void 0 ? void 0 : message.remove();
    });
}
function runYktAnswerLoop(worker, questionRootRef, doc) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const allResults = [];
        try {
            // 答题依赖解密后的明文，无论字体解密脚本是否开启都要确保启动
            yield ensureYktFontDecrypt(doc);
        }
        catch (err) {
            background_1.$console.error('字体解密初始化失败：', String(err));
        }
        // 左侧导航中的"未完成"题号，满足以下任一条件均视为已完成，不应重复作答
        // （否则可能把已提交的正确答案改错）：
        //   1. 含 .icon-status 图标标记（success=已提交且正确，danger=已提交但错误）
        //   2. 含"未批改"文本状态（.text-status，已作答待批改——无 .icon-status，需按文本排除）
        const getUnfinishedNavItems = () => Array.from(doc.querySelectorAll('.problems-aside .subject-item.J_order')).filter((el) => {
            var _a, _b;
            if (el.querySelector('.icon-status')) {
                return false;
            }
            if ((_b = (_a = el.querySelector('.text-status')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes('未批改')) {
                return false;
            }
            return true;
        });
        // 已处理的题号（按 data-order 记录，不依赖平台状态刷新，防重复作答）
        const processedOrders = new Set();
        const processedMarkers = new Set();
        let prevMarker = null;
        let completedAll = false;
        while (worker.isClose === false) {
            // 风控验证码检测：每次切题（点击下一题/题号）后、作答前执行，
            // 出现 #homework-automation-risk-challenge 时挂起等待用户手动完成验证
            yield waitYktCaptcha(doc);
            if (worker.isClose) {
                break;
            }
            // 每轮重新计算未完成列表（提交后平台会更新状态标记）
            const unfinished = getUnfinishedNavItems().filter((el) => { var _a; return !processedOrders.has((_a = el.getAttribute('data-order')) !== null && _a !== void 0 ? _a : ''); });
            if (unfinished.length === 0) {
                completedAll = true;
                break;
            }
            // 当前激活的未完成题优先作答，否则点击切换到第一个未完成题
            let target = unfinished.find((n) => n.classList.contains('active'));
            if (!target) {
                target = unfinished[0];
                prevMarker = currentYktQuestionMarker(doc);
                target.click();
                yield easy_us_1.$.sleep(1000);
                yield waitYktWorkConfirmDialog(doc);
            }
            yield waitYktQuestionReady(prevMarker, doc);
            const marker = currentYktQuestionMarker(doc);
            // 防死循环：marker 重复说明切换失败/状态异常
            if (marker && processedMarkers.has(marker)) {
                background_1.$console.warn(`[answer] 题目 "${marker}" 重复出现（切换失败或状态未刷新），终止作答以防死循环。`);
                break;
            }
            if (marker) {
                processedMarkers.add(marker);
            }
            const order = (_a = target.getAttribute('data-order')) !== null && _a !== void 0 ? _a : '';
            processedOrders.add(order);
            // 刷新题目容器引用（doWork 每次调用都重新读取 root 数组）
            questionRootRef.splice(0, questionRootRef.length, ...Array.from(doc.querySelectorAll('.container-problem .subject-item')));
            if (questionRootRef.length === 0) {
                break;
            }
            try {
                const results = yield worker.doWork({ enable_debug: background_1.BackgroundProject.scripts.dev.cfg.enable_answerer_debug });
                allResults.push(...results);
                const finished = !!((_c = (_b = results[0]) === null || _b === void 0 ? void 0 : _b.result) === null || _c === void 0 ? void 0 : _c.finish);
                // 平台切换题目不会保存答案，必须每题作答后立即提交
                if (finished) {
                    const submitted = yield submitYktCurrentQuestion(doc, order);
                    if (!submitted) {
                        background_1.$console.warn(`[answer] 本题提交失败: ${marker}`);
                    }
                }
                yield easy_us_1.$.sleep(1000);
                // 防止用户手动选择、脚本点击下一题而不是提交按钮 => 导致的确认弹窗。
                yield waitYktWorkConfirmDialog(doc);
            }
            catch (err) {
                background_1.$console.error('[answer] 答题异常，终止作答：', String(err));
                break;
            }
        }
        return { results: allResults, completedAll };
    });
}
/**
 * 创建作业答题 Worker 并驱动"逐题作答 -> 逐题提交 -> 下一题"主循环
 *（平台切题不保存答案，必须逐题提交）。
 * 全部完成后任务点自动标记完成，学习流程继续下一节。
 */
function createYktEmbeddedWorkLoop(opts, doc, onDone) {
    // 一题一题动态作答，结果逐题累积，标记为动态答题器以显示手动清空按钮
    common_1.CommonProject.scripts.workResults.methods.init({ dynamic: true });
    const { worker, questionRootRef } = createYktAnswerWorker(opts);
    (0, work_1.dynamicWorkTips)(worker);
    (() => __awaiter(this, void 0, void 0, function* () {
        const { results, completedAll } = yield runYktAnswerLoop(worker, questionRootRef, doc);
        worker.emit('done');
        // 平台切换题目不会保存答案，作答循环中已逐题提交。
        // 未全部完成时给出醒目提示，由用户手动处理剩余题目
        const finishCount = results.filter((r) => { var _a; return (_a = r.result) === null || _a === void 0 ? void 0 : _a.finish; }).length;
        if (!completedAll) {
            easy_us_1.$message.warn({
                content: `题目未全部完成（已作答提交 ${finishCount}/${results.length} 题），请手动检查剩余题目。`,
                duration: 0
            });
        }
        else {
            easy_us_1.$message.success({ content: `作业完成，全部 ${finishCount} 题已作答并逐题提交。` });
        }
        onDone();
    }))();
    return worker;
}
/**
 * 观看视频
 * @param setting
 * @returns
 */
function watch(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const set = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield easy_us_1.$.sleep(1000);
            const is_digital_human_video = !!document.querySelector('.digital-human-video-element-selector');
            if (is_digital_human_video) {
                // 成绩单里面进AI学伴会直接变成V2版本的视频，可能是雨课堂自身的BUG
                throw new Error('AI学伴视频请在学习内容中进入，不要在成绩单里进入。');
            }
            else {
                // 这里无法通过直接修改数值来修改倍速和音量，需要调用播放器的接口来修改
                const video_vue_data = (_a = document.querySelector('.xtplayer')) === null || _a === void 0 ? void 0 : _a.__vue__;
                if (video_vue_data) {
                    video_vue_data.player.options.speed.value = parseFloat(options.playbackRate.toString());
                    video_vue_data.player.options.volume.value = options.volume;
                    // 应用更改的音量和倍速设置
                    video_vue_data.player.init();
                }
            }
            const media = (yield (0, study_1.waitForElement)('video', {
                timeout_seconds: 10 * 1000
            }));
            console.log('media', media);
            yield easy_us_1.$.sleep(1000);
            if (media) {
                state.study.currentMedia = media;
                // 重置视频进度
                media.currentTime = 1;
            }
            return media;
        });
        easy_us_1.$message.info('开始播放');
        return new Promise((resolve, reject) => {
            /** 当前正在播放的视频元素 */
            let currentVideo;
            /** 视频切换检测定时器 */
            let videoCheckInterval;
            /** 连续获取视频失败的次数，防止无限重试 */
            let failCount = 0;
            const clearCheckInterval = () => {
                if (videoCheckInterval !== undefined) {
                    clearInterval(videoCheckInterval);
                    videoCheckInterval = undefined;
                }
            };
            const bindEvents = (video) => {
                video.onpause = () => __awaiter(this, void 0, void 0, function* () {
                    if (!video.ended) {
                        yield easy_us_1.$.sleep(1000);
                        video.play();
                    }
                });
                video.onended = () => {
                    clearCheckInterval();
                    utils_1.$msg.success('视频学习完成');
                    // 正常播放结束
                    resolve();
                };
            };
            const watch = () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const media = yield set();
                    if (!media) {
                        // 视频不存在，稍后重新观看
                        failCount++;
                        if (failCount >= 5) {
                            reject(new Error('video not found!'));
                            return;
                        }
                        easy_us_1.$message.info({ content: '未检测到视频，稍后重试...' });
                        setTimeout(watch, 3000);
                        return;
                    }
                    failCount = 0;
                    currentVideo = media;
                    bindEvents(media);
                    (0, utils_1.playMedia)(() => media.play());
                    // 检测视频是否被切换，切换后重新观看并继承当前 promise 的 resolve
                    clearCheckInterval();
                    videoCheckInterval = setInterval(() => {
                        if ((currentVideo === null || currentVideo === void 0 ? void 0 : currentVideo.isConnected) === false) {
                            clearCheckInterval();
                            easy_us_1.$message.info({ content: '检测到视频切换...' });
                            resolve();
                        }
                    }, 3000);
                }
                catch (e) {
                    clearCheckInterval();
                    reject(e);
                }
            });
            watch();
        });
    });
}
