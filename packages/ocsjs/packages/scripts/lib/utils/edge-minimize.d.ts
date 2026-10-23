/**
 * 边缘最小化判定：
 * 窗口为 minimize 状态且面板中心点位于视口左右 100px 吸附范围内时，进入图标吸附模式（隐藏头部、仅显示 OCS 图标）；
 * 否则退出图标模式，恢复普通最小化头部。
 */
export declare function updateEdgeMode(): void;
/**
 * 初始化边缘最小化图标模式（全页面执行一次）。
 * @param retry 容器元素未就绪时的重试次数（每次间隔 1s）
 */
export declare function initEdgeMinimize(retry?: number): void;
