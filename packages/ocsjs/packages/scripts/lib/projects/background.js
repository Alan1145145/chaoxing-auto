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
exports.$console = exports.BackgroundProject = void 0;
const core_1 = require("@ocsjs/core");
const markdown_1 = require("../utils/markdown");
const easy_us_1 = require("easy-us");
const gt_1 = __importDefault(require("semver/functions/gt"));
const valid_1 = __importDefault(require("semver/functions/valid"));
const common_1 = require("./common");
const __1 = require("..");
const render_1 = require("../render");
const search_infos_1 = require("../elements/search.infos");
const render_2 = require("../utils/render");
const state = {
    console: {
        listenerIds: {
            logs: 0
        }
    },
    app: {
        listenerIds: {
            sync: 0,
            connected: 0,
            closeSync: 0
        }
    }
};
/**
 * 监听网页开发者工具打开事件（仅触发一次，多种方式组合检测）。
 * 浏览器没有标准的开发者工具开关事件，以下为业界常用方案的组合：
 * 1. 快捷键监听：F12 / Ctrl(⌘)+Shift+I / Ctrl(⌘)+Shift+J / Ctrl(⌘)+Shift+C
 * 2. 视口差值检测：dock（内嵌）模式打开时挤压页面视口，outer 与 inner 差值变大（兜底，覆盖菜单/右键“检查”打开的情况）
 * 3. console 对象嗅探：Chrome 等浏览器仅在控制台打开时才会为 console.log 的对象求值，
 *    利用 id getter 是否被调用来判断（可覆盖独立窗口模式，控制台面板需处于可见状态）
 */
function onDevtoolsOpen(callback) {
    let triggered = false;
    const trigger = () => {
        if (triggered)
            return;
        triggered = true;
        window.removeEventListener('keydown', onKeydown, true);
        clearInterval(timer);
        callback();
    };
    // 方式一：监听打开开发者工具的快捷键
    const onKeydown = (e) => {
        if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))) {
            trigger();
        }
    };
    window.addEventListener('keydown', onKeydown, true);
    // 方式三探针：控制台打开时 console.log 会对对象求值，从而触发 id getter
    const probe = (0, easy_us_1.h)('div');
    Object.defineProperty(probe, 'id', {
        get: () => {
            trigger();
            return 'devtools-probe';
        }
    });
    const timer = setInterval(() => {
        // 方式二：dock 模式视口差值检测（阈值 160px）
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > 160 || heightDiff > 160) {
            trigger();
        }
    }, 1000);
}
/** 后台进程，处理与PC软件端的通讯，以及其他后台操作 */
exports.BackgroundProject = easy_us_1.Project.create({
    name: '其他',
    domains: [],
    scripts: {
        elementRegister: new easy_us_1.Script({
            name: '🔗 元素注册',
            hideInPanel: true,
            matches: [['所有页面', /.*/]],
            onstart() {
                // 注册自定义元素
                easy_us_1.$.loadCustomElements([search_infos_1.SearchInfosElement]);
            }
        }),
        console: new easy_us_1.Script({
            name: '📄 日志输出',
            matches: [['所有', /.*/]],
            namespace: 'render.console',
            configs: {
                logs: {
                    defaultValue: []
                }
            },
            onrender({ panel }) {
                const getTypeDesc = (type) => type === 'info'
                    ? '信息'
                    : type === 'error'
                        ? '错误'
                        : type === 'warn'
                            ? '警告'
                            : type === 'debug'
                                ? '调试'
                                : '日志';
                const createLog = (log) => {
                    const date = new Date(log.time);
                    const item = (0, easy_us_1.h)('div', {
                        title: '双击复制日志信息',
                        className: 'item'
                    }, [
                        (0, easy_us_1.h)('span', { className: 'time' }, `${date.getHours().toFixed(0).padStart(2, '0')}:${date.getMinutes().toFixed(0).padStart(2, '0')} `),
                        (0, easy_us_1.h)('span', { className: log.type }, `[${getTypeDesc(log.type)}]`),
                        (0, easy_us_1.h)('span', ':' + log.content)
                    ]);
                    item.addEventListener('dblclick', () => {
                        navigator.clipboard.writeText(Object.keys(log)
                            .map((k) => `${k}: ${log[k]}`)
                            .join('\n'));
                    });
                    return item;
                };
                const showLogs = () => {
                    const div = (0, easy_us_1.h)('div', { className: 'card console' });
                    const logs = this.cfg.logs.map((log) => createLog(log));
                    if (logs.length) {
                        div.replaceChildren(...logs);
                    }
                    else {
                        div.replaceChildren((0, easy_us_1.h)('div', '暂无任何日志', (div) => {
                            div.style.textAlign = 'center';
                        }));
                    }
                    return { div, logs };
                };
                /**
                 * 判断滚动条是否滚到底部
                 */
                const isScrollBottom = (div) => {
                    const { scrollHeight, scrollTop, clientHeight } = div;
                    return scrollTop + clientHeight + 50 > scrollHeight;
                };
                const { div, logs } = showLogs();
                this.offConfigChange(state.console.listenerIds.logs);
                state.console.listenerIds.logs = this.onConfigChange('logs', (logs) => {
                    const log = createLog(logs[logs.length - 1]);
                    div.append(log);
                    setTimeout(() => {
                        if (isScrollBottom(div)) {
                            log.scrollIntoView();
                        }
                    }, 10);
                });
                const show = () => {
                    panel.body.replaceChildren(div);
                    setTimeout(() => {
                        var _a;
                        (_a = logs[logs.length - 1]) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
                    }, 10);
                };
                show();
            }
        }),
        /** 渲染脚本，窗口渲染主要脚本（从 通用 迁移至 其他） */
        render: render_1.RenderScript,
        data: new easy_us_1.Script({
            name: '拓展数据',
            hideInPanel: true,
            matches: [['', /.*/]],
            namespace: 'background.data',
            configs: {
                notes: {
                    defaultValue: '这里是一些其他的应用或者拓展功能。'
                },
                /**
                 * 题库缓存
                 */
                localQuestionCaches: {
                    defaultValue: [],
                    extra: {
                        appConfigSync: false
                    }
                }
            },
            methods() {
                return {
                    /**
                     * 添加题库缓存
                     */
                    addQuestionCache: (...questionCacheItems) => __awaiter(this, void 0, void 0, function* () {
                        const questionCaches = this.cfg.localQuestionCaches;
                        for (const item of questionCacheItems) {
                            // 去重
                            if (questionCaches.find((c) => c.title === item.title && c.answer === item.answer) === undefined) {
                                questionCaches.unshift(item);
                            }
                        }
                        // 限制数量
                        questionCaches.splice(200);
                        this.cfg.localQuestionCaches = questionCaches;
                    }),
                    addQuestionCacheFromWorkResult(swr) {
                        exports.BackgroundProject.scripts.data.methods.addQuestionCache(...swr
                            .map((r) => r.searchInfos
                            .map((i) => i.results
                            .filter((res) => res[1])
                            .map((res) => ({
                            title: r.question,
                            answer: res[1],
                            from: i.name.replace(/【题库缓存】/g, ''),
                            homepage: i.homepage || ''
                        }))
                            .flat())
                            .flat())
                            .flat());
                    },
                    /**
                     * 将题库缓存作为题库并进行题目搜索
                     * @param title 题目
                     * @param whenSearchEmpty 当搜索结果为空，或者题库缓存功能被关闭时执行的函数
                     */
                    searchAnswerInCaches: (title, whenSearchEmpty) => __awaiter(this, void 0, void 0, function* () {
                        if (common_1.CommonProject.scripts.settings.cfg.enableQuestionCaches === false) {
                            return yield whenSearchEmpty();
                        }
                        let results = [];
                        const caches = this.cfg.localQuestionCaches;
                        for (const cache of caches) {
                            if (cache.title.trim() === title.trim()) {
                                results.push({
                                    name: cache.from,
                                    homepage: cache.homepage,
                                    results: [{ answer: cache.answer, question: cache.title, extra_data: { ai: cache.ai, cache: true } }]
                                });
                            }
                        }
                        if (results.length === 0) {
                            results = yield whenSearchEmpty();
                        }
                        return results;
                    }),
                    /**
                     * 展示题库缓存管理弹窗
                     */
                    showQuestionCaches: () => {
                        const questionCaches = this.cfg.localQuestionCaches;
                        const list = questionCaches.map((c) => (0, easy_us_1.h)('div', {
                            className: 'question-cache',
                            style: {
                                margin: '8px',
                                border: '1px solid lightgray',
                                borderRadius: '4px',
                                padding: '8px'
                            }
                        }, [
                            (0, easy_us_1.h)('div', { className: 'title' }, [
                                easy_us_1.$ui.tooltip((0, easy_us_1.h)('span', {
                                    title: `来自：${c.from || '未知题库'}\n主页：${c.homepage || '未知主页'}`,
                                    style: { fontWeight: 'bold' }
                                }, c.title))
                            ]),
                            (0, easy_us_1.h)('div', { className: 'answer', style: { marginTop: '6px' } }, c.answer)
                        ]));
                        const countEl = (0, easy_us_1.h)('span', ['当前缓存数量：' + questionCaches.length]);
                        easy_us_1.$modal.simple({
                            width: 800,
                            content: (0, easy_us_1.h)('div', [
                                (0, easy_us_1.h)('div', { className: 'notes card' }, [
                                    easy_us_1.$ui.notes([
                                        '题库缓存是将题库的题目和答案保存在内存，在重复使用时可以直接从内存获取，不需要再次请求题库。',
                                        '以下是当前存储的题库，默认存储200题，当前页面关闭后会自动清除。'
                                    ])
                                ]),
                                (0, easy_us_1.h)('div', { className: 'card' }, [
                                    easy_us_1.$ui.space([
                                        countEl,
                                        easy_us_1.$ui.button('清空题库缓存', {}, (btn) => {
                                            btn.onclick = () => {
                                                this.cfg.localQuestionCaches = [];
                                                countEl.innerText = '当前缓存数量：0';
                                                list.forEach((el) => el.remove());
                                            };
                                        })
                                    ], { separator: '|' })
                                ]),
                                (0, easy_us_1.h)('div', questionCaches.length === 0 ? [(0, easy_us_1.h)('div', { style: { textAlign: 'center' } }, '暂无题库缓存')] : list)
                            ])
                        });
                    }
                };
            }
        }),
        appConfigSync: new easy_us_1.Script({
            name: '🔄️ 软件配置同步',
            namespace: 'background.app',
            matches: [['所有页面', /./]],
            // 如果是在OCS软件中则不显示此页面
            hideInPanel: easy_us_1.$gm.getInfos() === undefined,
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        [
                            (0, easy_us_1.h)('span', [
                                '如果您使用',
                                (0, easy_us_1.h)('a', { href: 'https://docs.ocsjs.com/docs/app', target: '_blank' }, 'OCS桌面软件'),
                                '启动浏览器，并使用此脚本，'
                            ]),
                            '我们会同步软件中的配置到此脚本上，方便多个浏览器的管理。',
                            '窗口设置以及后台面板所有设置不会进行同步。'
                        ],
                        '如果不是，您可以忽略此脚本。'
                    ]).outerHTML
                },
                sync_status: {
                    defaultValue: 'unconnect'
                },
                closeSync: {
                    defaultValue: false,
                    label: '关闭同步',
                    attrs: {
                        type: 'checkbox'
                    }
                }
            },
            onrender({ panel }) {
                // 同步面板不会被锁定
                panel.lockWrapper.remove();
                panel.configsContainer.classList.remove('lock');
                const update = () => {
                    if (this.cfg.closeSync) {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['已关闭同步。']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else if (this.cfg.sync_status === 'synced') {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, [`已成功同步软件中的配置.`]);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else if (this.cfg.sync_status === 'unconnect') {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['未同步软件配置，可能是桌面软件未启动。']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else if (this.cfg.sync_status === 'not_playwright_environment') {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['当前浏览器不是由桌面端软件启动，无法同步配置。']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else if (this.cfg.sync_status === 'not_open_sync') {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['桌面端软件未开启配置同步功能']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else if (this.cfg.sync_status === 'empty_config') {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['已成功连接到软件，但配置为空。']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                    else {
                        const tip = (0, easy_us_1.h)('div', { className: 'notes card' }, ['同步状态未知，请稍后重试。']);
                        panel.body.replaceChildren((0, easy_us_1.h)('hr'), tip);
                    }
                };
                update();
                this.offConfigChange(state.app.listenerIds.sync);
                this.offConfigChange(state.app.listenerIds.connected);
                this.offConfigChange(state.app.listenerIds.closeSync);
                state.app.listenerIds.connected = this.onConfigChange('sync_status', update);
                state.app.listenerIds.closeSync = this.onConfigChange('closeSync', (closeSync) => {
                    if (closeSync) {
                        this.cfg.sync_status = 'not_open_sync';
                        easy_us_1.$message.success({ content: '已关闭同步，刷新页面后生效' });
                    }
                });
            },
            onactive() {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    if (easy_us_1.$.isInTopWindow()) {
                        if (this.cfg.closeSync) {
                            exports.$console.log('配置同步已关闭');
                            return;
                        }
                        this.cfg.sync_status = 'unconnect';
                        try {
                            const res = yield (0, core_1.request)('http://localhost:15319/browser', {
                                type: 'GM_xmlhttpRequest',
                                method: 'get',
                                responseType: 'json'
                            });
                            if (!res) {
                                this.cfg.sync_status = 'unconnect';
                                return;
                            }
                            const open_sync = yield (0, core_1.request)('http://localhost:15319/is-browser-config-sync', {
                                type: 'GM_xmlhttpRequest',
                                method: 'get',
                                responseType: 'text'
                            });
                            if (open_sync !== 'true') {
                                this.cfg.sync_status = 'not_open_sync';
                                return;
                            }
                            if (Object.keys(res).length === 0) {
                                this.cfg.sync_status = 'not_open_sync';
                                return;
                            }
                            // 自OCS软件 2.8.21 版本后特殊字段，用于标记不进行同步的字段
                            // 通过OCS playwright 启动的浏览器会自动返回数据
                            // 不使用 http 防止某些 Content-Security-Policy 限制
                            const environment_res = yield (0, core_1.request)(`http://localhost:15319/ocs-environment?page=${encodeURIComponent(window.location.href)}`, {
                                type: 'GM_xmlhttpRequest',
                                method: 'get'
                            });
                            const environment = environment_res === null || environment_res === void 0 ? void 0 : environment_res.environment;
                            if (!environment || environment !== 'playwright') {
                                this.cfg.sync_status = 'not_playwright_environment';
                                return;
                            }
                            // 排除几个特殊的设置
                            for (const key in res) {
                                if (Object.prototype.hasOwnProperty.call(res, key)) {
                                    // 排除渲染脚本的设置
                                    if (render_1.RenderScript.namespace && key.startsWith(render_1.RenderScript.namespace)) {
                                        Reflect.deleteProperty(res, key);
                                    }
                                    // 排除后台脚本的设置
                                    for (const scriptKey in exports.BackgroundProject.scripts) {
                                        if (Object.prototype.hasOwnProperty.call(exports.BackgroundProject.scripts, scriptKey)) {
                                            const script = Reflect.get(exports.BackgroundProject.scripts, scriptKey);
                                            if (script.namespace && key.startsWith(script.namespace)) {
                                                Reflect.deleteProperty(res, key);
                                            }
                                        }
                                    }
                                }
                            }
                            // 排除那些不用同步的配置
                            for (const project of (0, __1.definedProjects)()) {
                                for (const key in project.scripts) {
                                    if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
                                        const script = project.scripts[key];
                                        for (const ck in script.configs) {
                                            if (Object.prototype.hasOwnProperty.call(script.configs, ck)) {
                                                if (((_a = script.configs[ck].extra) === null || _a === void 0 ? void 0 : _a.appConfigSync) === false) {
                                                    Reflect.deleteProperty(res, easy_us_1.$.namespaceKey(script.namespace, ck));
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            // 同步所有的配置
                            for (const key in res) {
                                if (Object.prototype.hasOwnProperty.call(res, key)) {
                                    easy_us_1.$store.set(key, res[key]);
                                }
                            }
                            // 锁定面板
                            for (const project of (0, __1.definedProjects)()) {
                                // 排除后台脚本的锁定
                                if (project.name === exports.BackgroundProject.name) {
                                    continue;
                                }
                                for (const key in project.scripts) {
                                    if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
                                        const script = project.scripts[key];
                                        const originalRender = script.onrender;
                                        // 重新定义渲染函数。在渲染后添加锁定面板的代码
                                        script.onrender = ({ panel, header }) => {
                                            var _a, _b;
                                            originalRender === null || originalRender === void 0 ? void 0 : originalRender({ panel, header });
                                            if (panel.configsContainer.children.length) {
                                                panel.configsContainer.classList.add('lock');
                                                panel.lockWrapper.style.width = ((_a = panel.configsContainer.clientWidth) !== null && _a !== void 0 ? _a : panel.clientWidth) + 'px';
                                                panel.lockWrapper.style.height =
                                                    ((_b = panel.configsContainer.clientHeight) !== null && _b !== void 0 ? _b : panel.clientHeight) + 'px';
                                                panel.configsContainer.prepend(panel.lockWrapper);
                                                panel.lockWrapper.title =
                                                    '🚫已同步OCS桌面版软件配置，如需修改请在桌面版软件的左侧栏设置-通用设置-OCS配置，中进行修改。\n\n或者前往脚本悬浮窗:后台-软件配置同步 关闭配置同步功能。\n\n可双击强制修改，并关闭同步配置';
                                                panel.lockWrapper = easy_us_1.$ui.tooltip(panel.lockWrapper);
                                                panel.lockWrapper.addEventListener('dblclick', () => {
                                                    var _a;
                                                    panel.configsContainer.classList.remove('lock');
                                                    panel.lockWrapper.remove();
                                                    script.onrender = originalRender;
                                                    easy_us_1.$message.warn({
                                                        content: '已解除配置同步，可正常修改配置。想开启同步请前往：后台-软件配置同步',
                                                        duration: 10
                                                    });
                                                    this.cfg.closeSync = true;
                                                    if (script.panel && script.header) {
                                                        (_a = script.onrender) === null || _a === void 0 ? void 0 : _a.call(script, { panel: script.panel, header: script.header });
                                                    }
                                                });
                                            }
                                        };
                                        // 重新执行渲染
                                        if (script.panel && script.header) {
                                            script.onrender({ panel: script.panel, header: script.header });
                                        }
                                    }
                                }
                            }
                            this.cfg.sync_status = 'synced';
                        }
                        catch (e) {
                            console.error(e);
                            this.cfg.sync_status = 'unconnect';
                            // 可能是桌面软件未启动，或者未开启配置同步功能，此时直接隐藏脚本面板，防止用户误操作
                            this.hidePanel();
                        }
                    }
                });
            }
        }),
        update: new easy_us_1.Script({
            name: '📥 更新模块',
            matches: [['所有页面', /.*/]],
            namespace: 'background.update',
            configs: {
                notes: {
                    defaultValue: '脚本自动更新模块，如果有新的版本会自动通知。'
                },
                autoNotify: {
                    defaultValue: true,
                    label: '开启更新通知',
                    attrs: { type: 'checkbox', title: '当有最新的版本时自动弹窗通知，默认开启' }
                },
                notToday: {
                    defaultValue: -1
                },
                ignoreVersions: {
                    defaultValue: []
                }
            },
            methods() {
                return {
                    getLastVersion: () => __awaiter(this, void 0, void 0, function* () {
                        return (yield (0, core_1.request)('https://cdn.ocsjs.com/ocs-version.json?t=' + Date.now(), {
                            method: 'get',
                            type: 'GM_xmlhttpRequest'
                        }));
                    }),
                    /**
                     * 查看更新日志
                     */
                    showChangelog: () => __awaiter(this, void 0, void 0, function* () {
                        const changelog = (0, easy_us_1.h)('div', {
                            className: 'markdown card',
                            innerHTML: '加载中...',
                            style: { maxWidth: '600px' }
                        });
                        easy_us_1.$modal.simple({
                            width: 600,
                            content: (0, easy_us_1.h)('div', [
                                (0, easy_us_1.h)('div', { className: 'notes card' }, [
                                    easy_us_1.$ui.notes(['此页面实时更新，遇到问题可以查看最新版本是否修复。'])
                                ]),
                                changelog
                            ])
                        });
                        const md = yield (0, core_1.request)('https://cdn.ocsjs.com/articles/ocs/changelog.md?t=' + Date.now(), {
                            type: 'GM_xmlhttpRequest',
                            responseType: 'text',
                            method: 'get'
                        });
                        changelog.innerHTML = (0, markdown_1.markdown)(md);
                    })
                };
            },
            onrender({ panel }) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    const version = yield this.methods.getLastVersion();
                    const infos = easy_us_1.$gm.getInfos();
                    if (!infos) {
                        return;
                    }
                    const changeLog = (0, easy_us_1.h)('button', { className: 'base-style-button-secondary' }, '📄查看更新日志');
                    changeLog.onclick = () => this.methods.showChangelog();
                    const updatePage = ((_a = this.startConfig) === null || _a === void 0 ? void 0 : _a.updatePage) || '';
                    panel.body.replaceChildren((0, easy_us_1.h)('div', { className: 'card' }, [
                        (0, easy_us_1.h)('hr'),
                        (0, easy_us_1.h)('div', ['最新版本：' + version['last-version'] + ' - ', changeLog]),
                        (0, easy_us_1.h)('hr'),
                        (0, easy_us_1.h)('div', '当前版本：' + infos.script.version),
                        (0, easy_us_1.h)('div', '脚本管理器：' + infos.scriptHandler),
                        (0, easy_us_1.h)('div', ['脚本更新链接：', (0, easy_us_1.h)('a', { target: '_blank', href: updatePage }, [updatePage || '无'])])
                    ]));
                    console.log('versions', {
                        notToday: this.cfg.notToday,
                        ignoreVersions: this.cfg.ignoreVersions,
                        version: version
                    });
                });
            },
            oncomplete() {
                if (this.cfg.autoNotify && easy_us_1.$.isInTopWindow()) {
                    if (this.cfg.notToday === -1 || this.cfg.notToday !== new Date().getDate()) {
                        const infos = easy_us_1.$gm.getInfos();
                        if (infos) {
                            // 版本表达式验证
                            if (!!(0, valid_1.default)(infos.script.version) === false) {
                                easy_us_1.$message.error(`当前版本号 (${infos.script.version}) 不符合semver版本书写规范，请重新修改版本。`);
                                return;
                            }
                            // 避免阻挡用户操作，这里等页面运行一段时间后再进行更新提示
                            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                var _a;
                                const version = yield this.methods.getLastVersion();
                                const last = version['last-version'];
                                if (
                                // 跳过主动忽略的版本
                                this.cfg.ignoreVersions.includes(last) === false &&
                                    // 版本比较
                                    (0, gt_1.default)(last, infos.script.version)) {
                                    const updatePage = ((_a = this.startConfig) === null || _a === void 0 ? void 0 : _a.updatePage) || '';
                                    const modal = easy_us_1.$modal.confirm({
                                        maskCloseable: false,
                                        width: 600,
                                        content: easy_us_1.$ui.notes([`检测到新版本发布 ${last} ：`, [...(version.notes || [])]]),
                                        footer: (0, easy_us_1.h)('div', [
                                            (0, easy_us_1.h)('button', { className: 'base-style-button-secondary', innerText: '跳过此版本' }, (btn) => {
                                                btn.onclick = () => {
                                                    this.cfg.ignoreVersions = [...this.cfg.ignoreVersions, last];
                                                    modal === null || modal === void 0 ? void 0 : modal.remove();
                                                };
                                            }),
                                            (0, easy_us_1.h)('button', { className: 'base-style-button-secondary', innerText: '今日不再提示' }, (btn) => {
                                                btn.onclick = () => {
                                                    this.cfg.notToday = new Date().getDate();
                                                    modal === null || modal === void 0 ? void 0 : modal.remove();
                                                };
                                            }),
                                            (0, easy_us_1.h)('button', { className: 'base-style-button', innerText: '前往更新' }, (btn) => {
                                                btn.onclick = () => {
                                                    if (updatePage) {
                                                        window.open(updatePage, '_blank');
                                                        modal === null || modal === void 0 ? void 0 : modal.remove();
                                                    }
                                                    else {
                                                        easy_us_1.$message.error({ content: '无法前往更新页面，更新链接为空' });
                                                    }
                                                };
                                            })
                                        ])
                                    });
                                }
                            }), 5 * 1000);
                        }
                    }
                }
            }
        }),
        dev: new easy_us_1.Script({
            name: '🛠️ 开发者调试',
            namespace: 'background.dev',
            matches: [['所有页面', /./]],
            onstart() {
                if (self !== top)
                    return;
                // 默认隐藏开发者相关面板，监听开发者工具（F12）打开后再显示
                const devScripts = [this, exports.BackgroundProject.scripts.requestList];
                for (const script of devScripts) {
                    script.hidePanel();
                }
                onDevtoolsOpen(() => {
                    for (const script of devScripts) {
                        script.showPanel();
                    }
                    easy_us_1.$message.info({ content: '检测到开发者工具已打开，已显示 开发者调试/请求记录 面板。', duration: 5 });
                });
            },
            configs: {
                notes: {
                    defaultValue: '开发人员调试用。<br>注入OCS_CONTEXT全局变量。用户可忽略此页面。'
                },
                show_debug_cursor: {
                    defaultValue: true,
                    label: '软件辅助点击时显示鼠标位置',
                    attrs: { type: 'checkbox' }
                },
                enable_answerer_debug: {
                    defaultValue: true,
                    label: '开启答题日志输出',
                    attrs: { type: 'checkbox' }
                }
            },
            methods() {
                return {
                    getRemotePlaywrightCurrentPage: () => {
                        return core_1.RemotePlaywright.getRemotePage(this.cfg.show_debug_cursor, console.debug);
                    }
                };
            },
            onrender({ panel }) {
                const injectBtn = (0, easy_us_1.h)('button', { className: 'base-style-button' }, '点击注入全局变量');
                injectBtn.addEventListener('click', () => {
                    easy_us_1.$gm.unsafeWindow.OCS_CONTEXT = self;
                });
                const showTabDataBtn = (0, easy_us_1.h)('button', { className: 'base-style-button' }, '显示Tab存储');
                easy_us_1.$gm.getTab((tab) => {
                    const els = [];
                    for (const key in tab) {
                        if (Object.prototype.hasOwnProperty.call(tab, key)) {
                            els.push((0, easy_us_1.h)('div', [(0, easy_us_1.h)('b', key + ' : '), (0, easy_us_1.h)('code', JSON.stringify(tab[key]))]));
                        }
                    }
                    showTabDataBtn.addEventListener('click', () => {
                        easy_us_1.$modal.simple({
                            content: (0, easy_us_1.h)('div', els),
                            width: window.document.documentElement.clientWidth / 2
                        });
                    });
                });
                panel.body.replaceChildren((0, easy_us_1.h)('div', { className: 'card' }, [(0, easy_us_1.h)('hr'), injectBtn, showTabDataBtn]));
            }
        }),
        appLoginHelper: new easy_us_1.Script({
            name: '软件登录辅助',
            matches: [
                ['超星登录', 'passport2.chaoxing.com/login'],
                ['智慧树登录', 'passport.zhihuishu.com/login'],
                ['职教云登录', 'zjy2.icve.com.cn/portal/login.html'],
                ['智慧职教登录', 'sso.icve.com.cn/sso/auth']
            ],
            hideInPanel: true,
            oncomplete() {
                // 将面板移动至左侧顶部，防止挡住软件登录
                if (easy_us_1.$.isInTopWindow()) {
                    render_2.$render.moveToEdge();
                }
            }
        }),
        errorHandle: new easy_us_1.Script({
            name: '全局错误捕获',
            matches: [['', /.*/]],
            hideInPanel: true,
            onstart() {
                const projects = (0, __1.definedProjects)();
                for (const project of projects) {
                    for (const key in project.scripts) {
                        if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
                            const script = project.scripts[key];
                            script.on('scripterror', (err) => {
                                const msg = `[${project.name} - ${script.name}] : ${err}`;
                                console.error(msg);
                                exports.$console.error(msg);
                            });
                        }
                    }
                }
            }
        }),
        requestList: new easy_us_1.Script({
            name: '📄 请求记录',
            matches: [['', /.*/]],
            priority: 99,
            configs: {
                notes: {
                    defaultValue: easy_us_1.$ui.notes([
                        '开发人员请求调试记录页面，小白勿入，最多只记录最近的100个请求数据',
                        '可打开F12控制台查看请求日志，或者下方的请求列表'
                    ]).outerHTML
                },
                enable: {
                    label: '开启请求记录',
                    attrs: { type: 'checkbox' },
                    defaultValue: false
                },
                methodFilter: {
                    label: '方法过滤',
                    tag: 'select',
                    attrs: { placeholder: '选择选项' },
                    options: [['none', '无'], ['GET'], ['POST'], ['OPTIONS'], ['HEAD']],
                    defaultValue: 'none'
                },
                typeFilter: {
                    label: '类型过滤',
                    tag: 'select',
                    attrs: { placeholder: '选择选项' },
                    options: [
                        ['none', '无'],
                        ['gmxhr', '油猴API请求（gmxhr）'],
                        ['fetch', '普通请求（fetch）']
                    ],
                    defaultValue: 'none'
                },
                searchValue: {
                    label: '内容搜索',
                    attrs: { placeholder: '搜索 URL/请求体/响应' },
                    defaultValue: ''
                },
                list: {
                    defaultValue: []
                }
            },
            methods() {
                const render = (list) => {
                    var _a, _b;
                    (_a = this.panel) === null || _a === void 0 ? void 0 : _a.body.replaceChildren();
                    (_b = this.panel) === null || _b === void 0 ? void 0 : _b.body.append((0, easy_us_1.h)('div', { className: 'card' }, [
                        (0, easy_us_1.h)('div', { style: { padding: '8px 0px', textAlign: 'end' } }, [
                            (0, easy_us_1.h)('button', {
                                className: 'base-style-button-secondary',
                                style: { marginRight: '12px' },
                                innerText: '🗑️清空记录'
                            }, (btn) => {
                                btn.onclick = () => {
                                    this.cfg.list = [];
                                    render(this.cfg.list);
                                };
                            }),
                            (0, easy_us_1.h)('button', { className: 'base-style-button', innerText: '🔍执行搜索' }, (btn) => {
                                btn.onclick = () => {
                                    if (this.cfg.methodFilter === 'none' &&
                                        this.cfg.typeFilter === 'none' &&
                                        this.cfg.searchValue === '') {
                                        render(this.cfg.list);
                                    }
                                    else {
                                        const list = this.cfg.list
                                            .filter((item) => {
                                            if (this.cfg.methodFilter !== 'none' &&
                                                item.method.toLowerCase() !== this.cfg.methodFilter.toLowerCase()) {
                                                return false;
                                            }
                                            return true;
                                        })
                                            .filter((item) => {
                                            if (this.cfg.typeFilter !== 'none' && item.type !== this.cfg.typeFilter) {
                                                return false;
                                            }
                                            return true;
                                        })
                                            .filter((item) => {
                                            var _a, _b;
                                            if ((this.cfg.searchValue && item.url.includes(this.cfg.searchValue)) ||
                                                ((_a = item.data) === null || _a === void 0 ? void 0 : _a.includes(this.cfg.searchValue)) ||
                                                ((_b = item.response) === null || _b === void 0 ? void 0 : _b.includes(this.cfg.searchValue))) {
                                                return true;
                                            }
                                            return false;
                                        });
                                        render(list);
                                    }
                                };
                            })
                        ]),
                        (0, easy_us_1.h)('div', { style: { backgroundColor: '#292929', overflow: 'auto', maxHeight: window.innerHeight / 2 + 'px' } }, [
                            ...(list.length === 0
                                ? [(0, easy_us_1.h)('div', { style: { color: 'white', textAlign: 'center' } }, '暂无数据')]
                                : []),
                            ...list.map((item) => 
                            // @ts-ignore
                            (0, easy_us_1.h)('div', {
                                title: Object.entries(item)
                                    .map(([key, val]) => key === 'time'
                                    ? `${key} : ${new Date(val).toLocaleString().replace(/\//g, '-')}`
                                    : `${key} : ${val}`)
                                    .join('\n'),
                                style: {
                                    maxWidth: '800px',
                                    padding: '4px 0px',
                                    margin: '4px 0px',
                                    // @ts-ignore
                                    textWrap: 'nowrap'
                                }
                            }, [
                                (0, easy_us_1.h)('div', [
                                    (0, easy_us_1.h)('span', { style: { marginRight: '8px' } }, new Date(item.time).toLocaleTimeString()),
                                    (0, easy_us_1.h)('span', {
                                        style: {
                                            backgroundColor: '#2196f3a3',
                                            color: '#ececec',
                                            marginRight: '8px',
                                            padding: '0px 2px'
                                        }
                                    }, item.method),
                                    (0, easy_us_1.h)('span', { style: { color: item.response ? '#4eb74e' : '#eb6262', marginRight: '8px' } }, '●'),
                                    (0, easy_us_1.h)('div', { style: { display: 'inline-block', color: '#ececec' } }, item.url ? (item.url.length > 100 ? item.url.slice(0, 100) + '...' : item.url) : '-')
                                ]),
                                (0, easy_us_1.h)('div', { style: { overflow: 'hidden', fontSize: '12px', color: '#8f8f8f' } }, item.data ? 'data: ' + item.data : ''),
                                (0, easy_us_1.h)('div', { style: { overflow: 'hidden', fontSize: '12px', color: '#8f8f8f' } }, item.response ? 'resp: ' + item.response : item.error ? 'err : ' + item.error : '')
                            ]))
                        ])
                    ]));
                };
                return {
                    render: render
                };
            },
            onrender() {
                this.methods.render(this.cfg.list);
            },
            onstart() {
                // 兼容其他环境
                if (easy_us_1.$gm.isInGMContext() === false) {
                    return;
                }
                /* global GM_xmlhttpRequest  RequestInfo RequestInit */
                /* eslint-disable no-global-assign */
                const gmRequest = GM_xmlhttpRequest;
                const originalFetch = fetch;
                const getId = () => Math.random().toString(16).slice(2);
                const addRecord = (item) => {
                    this.cfg.list = [item, ...this.cfg.list];
                    if (this.cfg.list.length > 100) {
                        this.cfg.list = this.cfg.list.slice(0, 100);
                    }
                };
                const setItem = (id, response, error) => {
                    const list = JSON.parse(JSON.stringify(this.cfg.list));
                    const index = list.findIndex((item) => item.id === id);
                    if (index !== -1) {
                        list[index].response = response;
                        list[index].error = error;
                    }
                    this.cfg.list = list;
                };
                // @ts-ignore
                GM_xmlhttpRequest = (details) => {
                    if (this.cfg.enable) {
                        const id = getId();
                        const data = {
                            id: id,
                            url: details.url,
                            method: details.method || 'unknown',
                            type: 'gmxhr',
                            data: details.data,
                            headers: details.headers,
                            response: '',
                            error: '',
                            time: Date.now()
                        };
                        addRecord(data);
                        const onload = details.onload;
                        const onerror = details.onerror;
                        details.onload = function (response) {
                            setItem(id, response.responseText, '');
                            data.response = details.responseType === 'json' ? response.response : response.responseText;
                            console.log('%c [请求成功]', 'color: green; font-weight: bold', data.url, data);
                            onload === null || onload === void 0 ? void 0 : onload.apply(this, [response]);
                        };
                        details.onerror = function (response) {
                            setItem(id, '', response.error);
                            data.error = response.error;
                            console.log('%c [请求失败]', 'color: red; font-weight: bold', data.url, data);
                            onerror === null || onerror === void 0 ? void 0 : onerror.apply(this, [response]);
                        };
                    }
                    return gmRequest.apply(this, [details]);
                };
                // @ts-ignore
                fetch = (input, init) => {
                    if (this.cfg.enable) {
                        const id = getId();
                        const data = {
                            id: id,
                            url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
                            method: (init === null || init === void 0 ? void 0 : init.method) || 'unknown',
                            type: 'fetch',
                            data: init === null || init === void 0 ? void 0 : init.body,
                            headers: init === null || init === void 0 ? void 0 : init.headers,
                            response: '',
                            error: '',
                            time: Date.now()
                        };
                        addRecord(data);
                        const res = originalFetch.apply(this, [input, init]);
                        res
                            .then((result) => {
                            return result.clone().text();
                        })
                            .then((result) => {
                            setItem(id, result, '');
                            data.response = result;
                            console.log('%c [请求成功]', 'color: green; font-weight: bold', data.url, data);
                        });
                        res.catch((err) => {
                            setItem(id, '', String(err));
                            data.error = String(err);
                            console.log('%c [请求失败]', 'color: red; font-weight: bold', data.url, data);
                        });
                        return res;
                    }
                    else {
                        return originalFetch.apply(this, [input, init]);
                    }
                };
            }
        }),
        environmentDetect: new easy_us_1.Script({
            name: '🤖 环境检测',
            matches: [['所有页面', /.*/]],
            hideInPanel: true,
            oncomplete() {
                if (self !== top)
                    return;
                const matches = [
                    __1.CXProject.scripts.studyDispatcher.matches,
                    __1.ZHSProject.scripts['gxk-study'].matches,
                    __1.ZHSProject.scripts.hike.matches,
                    __1.ZHSProject.scripts['smart-study'].matches,
                    __1.ZHSProject.scripts['wisdom-study'].matches,
                    __1.ZHSProject.scripts['xnk-study'].matches,
                    __1.ICourseProject.scripts.study.matches,
                    __1.IcveMoocProject.scripts.study.matches,
                    __1.ZJYProject.scripts.study.matches
                ]
                    .flat()
                    .map((m) => (Array.isArray(m) ? m[1] : m));
                const url = window.location.href;
                const match = matches.some((regex) => {
                    return typeof regex === 'string' ? url.includes(regex) : regex.test(url);
                });
                if (!match) {
                    return;
                }
                let messageElement;
                visibleDetect();
                function visibleDetect() {
                    setTimeout(() => {
                        if (!(messageElement === null || messageElement === void 0 ? void 0 : messageElement.isConnected))
                            messageElement = undefined;
                        if (document.visibilityState === 'hidden' && !messageElement) {
                            messageElement = easy_us_1.$message.warn({
                                content: '⚠️检测到浏览器最小化/切屏，脚本可能无法正常运行，请保持网课页面在前台！（如果您正在全屏游戏中可以忽略此警告）',
                                duration: 0
                            });
                        }
                        visibleDetect();
                    }, 1000);
                }
            }
        }),
        menus: new easy_us_1.Script({
            name: '📁 菜单管理',
            hideInPanel: true,
            matches: [['所有页面', /.*/]],
            oncomplete() {
                return __awaiter(this, void 0, void 0, function* () {
                    // 注册快捷菜单
                    yield (0, easy_us_1.$menu)('🏠', { scriptPanelLink: common_1.CommonProject.scripts.guide });
                    yield (0, easy_us_1.$menu)('🔎', { scriptPanelLink: common_1.CommonProject.scripts.workResults });
                    yield (0, easy_us_1.$menu)('⚙️', { scriptPanelLink: common_1.CommonProject.scripts.settings });
                    yield (0, easy_us_1.$menu)('📄', { scriptPanelLink: exports.BackgroundProject.scripts.console });
                    const currentStudyScript = [
                        [__1.CXProject.scripts.studyDispatcher, __1.CXProject.scripts.study],
                        __1.CXProject.scripts.work,
                        __1.CXProject.scripts.autoRead,
                        __1.ZHSProject.scripts['study-center'],
                        __1.ZHSProject.scripts['work-center'],
                        [__1.ICourseProject.scripts.dispatcher, __1.ICourseProject.scripts.study],
                        __1.ICourseProject.scripts.work,
                        [__1.ZJYProject.scripts.dispatcher, __1.ZJYProject.scripts.study],
                        __1.ZJYProject.scripts.work,
                        __1.IcveMoocProject.scripts.study,
                        __1.IcveMoocProject.scripts.work,
                        __1.YKTProject.scripts.ai
                    ]
                        .map((m) => {
                        const url = window.location.href;
                        const data = {
                            matches: Array.isArray(m) ? m[0].matches : m.matches,
                            target: Array.isArray(m) ? m[1] : m
                        };
                        if (data.matches.some((regexp) => {
                            const r = Array.isArray(regexp) ? regexp[1] : regexp;
                            return typeof r === 'string' ? url.includes(r) : r.test(url);
                        })) {
                            return data.target;
                        }
                        return undefined;
                    })
                        .find((m) => m !== undefined);
                    if (currentStudyScript) {
                        // 注册当前学习脚本的快捷菜单
                        yield (0, easy_us_1.$menu)('🖥️', { scriptPanelLink: currentStudyScript });
                        // 置顶面板
                        exports.BackgroundProject.scripts.render.methods.pin(currentStudyScript);
                    }
                });
            }
        })
    }
});
/** 日志对象，存储日志并显示在日志面板 */
exports.$console = new Proxy({}, {
    get(target, key) {
        return (...msg) => {
            var _a;
            let logs = exports.BackgroundProject.scripts.console.cfg.logs;
            if (logs.length > 50) {
                logs = logs.slice(-50);
            }
            const stack_str = Error().stack || '';
            // 简化堆栈信息
            const stacks = (_a = stack_str
                .replace('Error', '')
                .match(/at (.*) \(.+:\/\/.+:(.+):(.+)\)/g)) === null || _a === void 0 ? void 0 : _a.map((s) => {
                const match = s.match(/at (.*) \(.+:\/\/.+:(.+):(.+)\)/) || [];
                return [match[1], match[2], match[3]];
            });
            logs = logs.concat({
                type: key.toString(),
                content: msg.join(' '),
                time: Date.now(),
                stack: JSON.stringify([stack_str.split('\n')[0], ...(stacks || [])])
            });
            exports.BackgroundProject.scripts.console.cfg.logs = logs;
        };
    }
});
