<template>
	<div class="embedded-workspace">
		<div
			v-if="embeddedBrowsers.length"
			class="session-tabs"
			aria-label="运行中的浏览器"
		>
			<button
				class="session-home"
				@click="router.push('/browsers')"
			>
				浏览器列表
			</button>
			<div
				v-for="uid in embeddedBrowsers"
				:key="uid"
				class="session-tab"
				:class="{ selected: activeBrowserUid === uid }"
			>
				<button
					class="session-name"
					@click="Browser.from(uid)?.openInApp()"
				>
					<span class="session-dot" />{{ Browser.from(uid)?.name || '浏览器' }}
				</button>
				<button
					class="session-close"
					:aria-label="`关闭 ${Browser.from(uid)?.name || '浏览器'}`"
					@click="Browser.from(uid)?.close()"
				>
					×
				</button>
			</div>
		</div>
		<div
			v-show="!activeBrowserUid"
			class="workspace-route"
		>
			<slot />
		</div>
		<EmbeddedBrowser
			v-for="uid in embeddedBrowsers"
			v-show="activeBrowserUid === uid"
			:key="uid"
			:uid="uid"
			class="workspace-guest"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { router } from '../route';
import { store } from '../store';
import { Browser } from '../fs/browser';
import { embeddedBrowsers, openEmbeddedBrowser } from '../composables/useEmbeddedBrowsers';
import EmbeddedBrowser from '../pages/embedded-browser/index.vue';

const activeBrowserUid = computed(() =>
	router.currentRoute.value.name === 'embedded-browser' ? String(router.currentRoute.value.params.uid || '') : ''
);
watch(
	activeBrowserUid,
	(uid) => {
		if (uid) openEmbeddedBrowser(uid);
		// currentBrowserUid controls the profile editor modal, not the live guest.
		store.render.browser.currentBrowserUid = '';
	},
	{ immediate: true }
);
</script>

<style lang="less">
.embedded-workspace {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	min-width: 0;
	overflow: hidden;
}
.workspace-route {
	flex: 1;
	min-height: 0;
	overflow: auto;
	overscroll-behavior: contain;
}
.workspace-guest {
	flex: 1;
	height: 0 !important;
	min-width: 0;
}
.session-tabs {
	display: flex;
	gap: 6px;
	padding: 10px 12px 0;
	overflow-x: auto;
	flex-shrink: 0;
	border-bottom: 1px solid var(--color-border-2);
	background: var(--color-bg-2);
}
.session-tabs button {
	border: 0;
	background: transparent;
	color: inherit;
	cursor: pointer;
	font: inherit;
}
.session-home {
	padding: 9px 12px;
	white-space: nowrap;
	color: var(--color-text-3) !important;
}
.session-tab {
	display: flex;
	border-radius: 8px 8px 0 0;
	background: var(--color-fill-2);
	color: var(--color-text-2);
	flex-shrink: 0;
}
.session-tab.selected {
	background: rgb(var(--primary-1));
	color: rgb(var(--primary-6));
	box-shadow: inset 0 -2px rgb(var(--primary-6));
}
.session-name {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	max-width: 200px;
	overflow: hidden;
	white-space: nowrap;
}
.session-dot {
	width: 6px;
	height: 6px;
	background: #22a06b;
	border-radius: 50%;
	flex-shrink: 0;
}
.session-close {
	padding: 0 10px;
	font-size: 18px !important;
	border-radius: 6px;
}
.session-close:hover {
	background: var(--color-fill-3);
}
.session-tabs button:focus-visible {
	outline: 2px solid rgb(var(--primary-6));
	outline-offset: -2px;
}
</style>
