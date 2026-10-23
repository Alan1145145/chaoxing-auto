<template>
	<div>
		<template
			v-for="(banner, index) in visibleBanners"
			:key="index"
		>
			<a-alert
				:type="banner.type || 'info'"
				:title="banner.title"
				show-icon
				banner
				closable
				class="rounded"
				@close="onClose(index)"
			>
				{{ banner.content }}
			</a-alert>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { BannerResource } from '@ocs-desktop/common/src/api';

/**
 * 本地提示横幅。
 * 原版从 cdn.ocsjs.com 获取远程横幅公告，已停用，改为固定的本地提示。
 */
const visibleBanners = ref<BannerResource[]>([
	{
		type: 'info',
		title: '第一次使用？',
		content: '请先阅读顶部「帮助」→「使用教程」：从新建学习空间、登录学习通到设置豆包 AI 答题，都有详细步骤。'
	} as BannerResource
]);

function onClose(index: number) {
	visibleBanners.value.splice(index, 1);
}
</script>
