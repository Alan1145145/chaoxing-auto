import { SimplifyWorkResult, QuestionTypes } from '@ocsjs/core';
/**
 * 搜索结果元素
 */
export declare class SearchInfosElement extends HTMLElement {
    /** 搜索结果 [题目，答案] */
    infos: SimplifyWorkResult['searchInfos'];
    /** 当前的题目 */
    question: string;
    type: QuestionTypes;
    connectedCallback(): void;
}
