<template>
	<nav
		class="app-navigation"
		:class="{ compact: !store.render.setting.showSideBarText }"
		aria-label="主导航"
	>
		<button
			class="nav-brand"
			aria-label="学习概览"
			title="学习概览"
			@click="router.push('/workbench')"
		>
			<img :src="'./ai-study-icon.svg'" alt="超星自动机" />
		</button>
		<button
			v-for="item in menuRoutes"
			:key="item.name"
			type="button"
			:title="item.meta.title"
			:aria-label="item.meta.title"
			:aria-current="item.name === currentRoute.name ? 'page' : undefined"
			:class="{ active: item.name === currentRoute.name }"
			@click="navigate(item)"
		>
			<Icon
				:type="item.meta.icon"
				:size="21"
				theme="outlined"
			/>
			<span v-if="store.render.setting.showSideBarText">{{ item.meta.title }}</span>
		</button>
		<div class="nav-bottom"><i />本地工作空间<small>CHAOXING · AUTO</small></div>
	</nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { routes, CustomRouteType } from '../route';
import { remote } from '../utils/remote';
import { store } from '../store';
import { inBrowser } from '../utils/node';
import Icon from './Icon.vue';

const router = useRouter();
const currentRoute = router.currentRoute;
const menuRoutes = computed(() =>
	((routes.find((item) => item.name === 'index')?.children || []) as CustomRouteType[]).filter(
		(item) => !item.meta?.hideInMenu
	)
);
async function navigate(item: CustomRouteType) {
	await router.push({ name: item.name });
	if (!inBrowser) await remote.win.call('setTitle', `超星自动机 · ${item.meta.title}`);
}
</script>

<style scoped lang="less">
.app-navigation {
	width: 100px;
	flex: 0 0 100px;
	padding: 20px 12px;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
	background: var(--dew-bg);
	overflow-y: auto;
	overflow-x: hidden;
}
.app-navigation.compact {
	width: 64px;
	flex-basis: 64px;
}
.app-navigation.compact .nav-bottom {
	display: none;
}
.app-navigation button {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	width: 100%;
	padding: 13px 2px;
	margin-bottom: 7px;
	flex-shrink: 0;
	border: 0;
	border-radius: 16px;
	background: transparent;
	color: var(--dew-muted);
	cursor: pointer;
	font: inherit;
	font-size: 10px;
	white-space: nowrap;
	text-align: left;
}
.app-navigation button:hover {
	background: var(--dew-surface);
}
.app-navigation button.active {
	background: var(--dew-surface);
	color: var(--dew-text);
	font-weight: 600;
}
.app-navigation button:focus-visible {
	outline: 2px solid rgb(var(--primary-6));
	outline-offset: -2px;
}
.app-navigation :deep(.icon) {
	font-size: 22px;
	flex-shrink: 0;
}
.app-navigation .nav-brand {
	height: 48px;
	width: 48px;
	padding: 0 0 0 12px;
	display: block;
	background: var(--dew-text);
	color: var(--dew-surface);
	border-radius: 50%;
	font-size: 34px;
	letter-spacing: -5px;
	text-align: left;
	margin-bottom: 28px;
	line-height: 1;
}
.app-navigation .nav-brand {
	padding: 0;
	background: transparent;
}
.nav-brand img {
	display: block;
	width: 48px;
	height: 48px;
}
.nav-bottom {
	margin-top: auto;
	padding-top: 32px;
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 8px;
	font-size: 9px;
	color: var(--dew-muted);
	white-space: nowrap;
}
.nav-bottom small {
	font-size: 6px;
	letter-spacing: 0.4px;
}
.nav-bottom i {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #8b9868;
}
@media (max-width: 720px) {
	.app-navigation {
		width: 72px;
		flex-basis: 72px;
		padding-left: 8px;
		padding-right: 8px;
	}
	.nav-bottom {
		display: none;
	}
}
</style>
