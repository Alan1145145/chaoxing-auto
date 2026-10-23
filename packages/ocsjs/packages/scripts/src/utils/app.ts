import { $message, $modal, h } from 'easy-us';

export const $playwright = {
	showError: () => {
		const href = 'https://docs.ocsjs.com/docs/script-helper';
		const errorEl = h('div', [
			'当前页面需要下载OCS桌面端，并在桌面端中新建浏览器，在新建的浏览器中才能进行正常刷课，点击链接查看详情 => ',
			h('a', { href: href, target: '_blank' }, href)
		]);
		$modal.alert({
			maskCloseable: false,
			title: '⛔ 错误',
			confirmButtonText: '查看详情',
			content: errorEl.cloneNode(true),
			onConfirm() {
				window.open(href, '_blank');
			}
		});
		$message.error({ content: errorEl.cloneNode(true), duration: 0 });
	}
};
