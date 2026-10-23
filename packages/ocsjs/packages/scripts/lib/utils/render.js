"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.$render = void 0;
const background_1 = require("../projects/background");
exports.$render = {
    /**
     * 移动到边缘
     */
    moveToEdge(x = 80, y = 100) {
        background_1.BackgroundProject.scripts.render.methods.minimize();
        background_1.BackgroundProject.scripts.render.methods.setPosition(x, y);
    }
};
