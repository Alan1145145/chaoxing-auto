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
exports.createDefaultQuestionResolver = exports.CustomOCSWorker = exports.OCSWorker = void 0;
__exportStar(require("./interface"), exports);
__exportStar(require("./utils"), exports);
var worker_1 = require("./worker");
Object.defineProperty(exports, "OCSWorker", { enumerable: true, get: function () { return worker_1.OCSWorker; } });
Object.defineProperty(exports, "CustomOCSWorker", { enumerable: true, get: function () { return worker_1.CustomOCSWorker; } });
var question_resolver_1 = require("./question.resolver");
Object.defineProperty(exports, "createDefaultQuestionResolver", { enumerable: true, get: function () { return question_resolver_1.createDefaultQuestionResolver; } });
