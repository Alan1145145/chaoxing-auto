import { RawElements, SearchedElements } from '../worker/interface';
/**
 * 与 {@link domSearchAll } 相同，区别是这个只返回单个元素，而不是一个元素数组
 * @param root
 * @param wrapper
 * @returns
 */
export declare function domSearch<E extends RawElements>(
/** 搜索构造器 */
wrapper: E, root?: HTMLElement | Document): SearchedElements<E, HTMLElement | null>;
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
export declare function domSearchAll<E extends RawElements>(
/** 搜索构造器 */
wrapper: E, root?: HTMLElement | Document): SearchedElements<E, HTMLElement[]>;
