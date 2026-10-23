"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.domSearchAll = exports.domSearch = void 0;
/**
 * 与 {@link domSearchAll } 相同，区别是这个只返回单个元素，而不是一个元素数组
 * @param root
 * @param wrapper
 * @returns
 */
function domSearch(
/** 搜索构造器 */
wrapper, root = window.document) {
    const obj = Object.create({});
    Reflect.ownKeys(wrapper).forEach((key) => {
        const item = wrapper[key.toString()];
        Reflect.set(obj, key, typeof item === 'string'
            ? root.querySelector(item)
            : typeof item === 'function'
                ? item(root)
                : item.map((fun) => fun(root)));
    });
    return obj;
}
exports.domSearch = domSearch;
/**
 * 元素搜索
 *
 * @example
 *
 * const { title , btn , arr } = domSearch(document.body,{
 *      title: '.title'
 *      btn: ()=> '.btn',
 *      arr: ()=> Array.from(document.body.querySelectorAll('.function-arr'))
 * })
 *
 * console.log(title) // 等价于 Array.from(document.body.querySelectorAll('.title'))
 * console.log(btn)// 等价于 Array.from(document.body.querySelectorAll('.btn'))
 */
function domSearchAll(
/** 搜索构造器 */
wrapper, root = window.document) {
    const obj = Object.create({});
    Reflect.ownKeys(wrapper).forEach((key) => {
        const item = wrapper[key.toString()];
        Reflect.set(obj, key, typeof item === 'string'
            ? Array.from(root.querySelectorAll(item))
            : typeof item === 'function'
                ? item(root).filter(Boolean)
                : item.map((fun) => fun(root)));
    });
    return obj;
}
exports.domSearchAll = domSearchAll;
