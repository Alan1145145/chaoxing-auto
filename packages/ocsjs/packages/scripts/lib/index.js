"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definedProjects = exports.waitForAnswererConfig = exports.openAnswererConnect = exports.getAnswererConfigProvider = exports.setAnswererConfigProvider = exports.logoSvg = exports.RenderScript = exports.createOcsQuestionBankAnswererWrapper = exports.YKTProject = exports.ICourseProject = exports.IcveMoocProject = exports.ZJYProject = exports.CXProject = exports.ZHSProject = exports.CommonProject = exports.BackgroundProject = exports.$store = exports.$elements = exports.start = void 0;
const common_1 = require("./projects/common");
const zhs_1 = require("./projects/zhs");
const cx_1 = require("./projects/cx");
const background_1 = require("./projects/background");
const icve_1 = require("./projects/icve");
const zjy_1 = require("./projects/zjy");
const icourse_1 = require("./projects/icourse");
const yuketang_1 = require("./projects/yuketang");
/** 导出所有的 OCS 核心模块 */
__exportStar(require("@ocsjs/core"), exports);
/** 导出启动函数，以及全局对象 */
var easy_us_1 = require("easy-us");
Object.defineProperty(exports, "start", { enumerable: true, get: function () { return easy_us_1.start; } });
Object.defineProperty(exports, "$elements", { enumerable: true, get: function () { return easy_us_1.$elements; } });
Object.defineProperty(exports, "$store", { enumerable: true, get: function () { return easy_us_1.$store; } });
/** 导出本包的核心脚本工程，开发者调试的时候使用 BackgroundProject 中的注入脚本，访问脚本 window 上下文 */
var background_2 = require("./projects/background");
Object.defineProperty(exports, "BackgroundProject", { enumerable: true, get: function () { return background_2.BackgroundProject; } });
var common_2 = require("./projects/common");
Object.defineProperty(exports, "CommonProject", { enumerable: true, get: function () { return common_2.CommonProject; } });
var zhs_2 = require("./projects/zhs");
Object.defineProperty(exports, "ZHSProject", { enumerable: true, get: function () { return zhs_2.ZHSProject; } });
var cx_2 = require("./projects/cx");
Object.defineProperty(exports, "CXProject", { enumerable: true, get: function () { return cx_2.CXProject; } });
var zjy_2 = require("./projects/zjy");
Object.defineProperty(exports, "ZJYProject", { enumerable: true, get: function () { return zjy_2.ZJYProject; } });
var icve_2 = require("./projects/icve");
Object.defineProperty(exports, "IcveMoocProject", { enumerable: true, get: function () { return icve_2.IcveMoocProject; } });
var icourse_2 = require("./projects/icourse");
Object.defineProperty(exports, "ICourseProject", { enumerable: true, get: function () { return icourse_2.ICourseProject; } });
var yuketang_2 = require("./projects/yuketang");
Object.defineProperty(exports, "YKTProject", { enumerable: true, get: function () { return yuketang_2.YKTProject; } });
var common_3 = require("./projects/common");
Object.defineProperty(exports, "createOcsQuestionBankAnswererWrapper", { enumerable: true, get: function () { return common_3.createOcsQuestionBankAnswererWrapper; } });
var render_1 = require("./render");
Object.defineProperty(exports, "RenderScript", { enumerable: true, get: function () { return render_1.RenderScript; } });
var ui_1 = require("./utils/ui");
Object.defineProperty(exports, "logoSvg", { enumerable: true, get: function () { return ui_1.logoSvg; } });
var answerer_connect_1 = require("./utils/answerer-connect");
Object.defineProperty(exports, "setAnswererConfigProvider", { enumerable: true, get: function () { return answerer_connect_1.setAnswererConfigProvider; } });
Object.defineProperty(exports, "getAnswererConfigProvider", { enumerable: true, get: function () { return answerer_connect_1.getAnswererConfigProvider; } });
Object.defineProperty(exports, "openAnswererConnect", { enumerable: true, get: function () { return answerer_connect_1.openAnswererConnect; } });
Object.defineProperty(exports, "waitForAnswererConfig", { enumerable: true, get: function () { return answerer_connect_1.waitForAnswererConfig; } });
function definedProjects() {
    return [
        zhs_1.ZHSProject,
        cx_1.CXProject,
        icve_1.IcveMoocProject,
        zjy_1.ZJYProject,
        icourse_1.ICourseProject,
        yuketang_1.YKTProject,
        common_1.CommonProject,
        background_1.BackgroundProject
    ];
}
exports.definedProjects = definedProjects;
