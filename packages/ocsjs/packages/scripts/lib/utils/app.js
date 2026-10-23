"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.$playwright = void 0;
const easy_us_1 = require("easy-us");
exports.$playwright = {
    showError: () => {
        const href = 'https://docs.ocsjs.com/docs/script-helper';
        const errorEl = (0, easy_us_1.h)('div', [
            '当前页面需要下载OCS桌面端，并在桌面端中新建浏览器，在新建的浏览器中才能进行正常刷课，点击链接查看详情 => ',
            (0, easy_us_1.h)('a', { href: href, target: '_blank' }, href)
        ]);
        easy_us_1.$modal.alert({
            maskCloseable: false,
            title: '⛔ 错误',
            confirmButtonText: '查看详情',
            content: errorEl.cloneNode(true),
            onConfirm() {
                window.open(href, '_blank');
            }
        });
        easy_us_1.$message.error({ content: errorEl.cloneNode(true), duration: 0 });
    }
};
