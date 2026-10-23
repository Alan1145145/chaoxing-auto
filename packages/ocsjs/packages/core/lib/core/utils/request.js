"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = void 0;
const common_1 = require("../../utils/common");
/**
 * 发起请求
 * @param url 请求地址
 * @param opts 请求参数
 */
function request(url, opts) {
    return new Promise((resolve, reject) => {
        try {
            /** 默认参数 */
            const { responseType = 'json', method = 'get', type = 'fetch', data = {}, headers = {} } = opts || {};
            /** 环境变量 */
            const env = common_1.$.isInBrowser() ? 'browser' : 'node';
            /** 如果是跨域模式并且是浏览器环境 */
            if (type === 'GM_xmlhttpRequest' && env === 'browser') {
                if (typeof GM_xmlhttpRequest !== 'undefined') {
                    const contentType = headers['Content-Type'] || headers['content-type'];
                    const requestData = contentType === 'application/x-www-form-urlencoded'
                        ? new URLSearchParams(data).toString()
                        : Object.keys(data).length
                            ? JSON.stringify(data)
                            : undefined;
                    // eslint-disable-next-line no-undef
                    GM_xmlhttpRequest({
                        url,
                        method: method.toUpperCase(),
                        data: requestData,
                        headers: Object.keys(headers).length ? headers : undefined,
                        responseType: responseType === 'json' ? 'json' : undefined,
                        onload: (response) => {
                            if (opts.anyStatus) {
                                resolve({ status: response.status, responseText: response.responseText || '' });
                                return;
                            }
                            if (response.status === 200) {
                                if (responseType === 'json') {
                                    try {
                                        resolve(JSON.parse(response.responseText));
                                    }
                                    catch (error) {
                                        reject(error);
                                    }
                                }
                                else {
                                    resolve(response.responseText || '');
                                }
                            }
                            else {
                                reject(response.responseText);
                            }
                        },
                        onerror: (err) => {
                            console.error('GM_xmlhttpRequest error', err);
                            reject(err);
                        }
                    });
                }
                else {
                    reject(new Error('GM_xmlhttpRequest is not defined'));
                }
            }
            else {
                const fet = env === 'node' ? require('node-fetch').default : fetch;
                fet(url, { body: method === 'post' ? JSON.stringify(data) : undefined, method, headers })
                    .then((response) => {
                    if (opts.anyStatus) {
                        response
                            .text()
                            .then((text) => resolve({ status: response.status, responseText: text }))
                            .catch(reject);
                        return;
                    }
                    if (responseType === 'json') {
                        response.json().then(resolve).catch(reject);
                    }
                    else {
                        // @ts-ignore
                        response.text().then(resolve).catch(reject);
                    }
                })
                    .catch((error) => {
                    reject(new Error(error));
                });
            }
        }
        catch (error) {
            reject(error);
        }
    });
}
exports.request = request;
