<template>
	<article
		class="space-card"
		:class="{ 'is-selected': browser.checked }"
	>
		<div class="space-card-top">
			<span class="space-emblem"
				><Icon
					type="language"
					:size="25" /></span
			><span
				class="space-status"
				:class="{ running }"
				><i />{{ running ? '运行中' : '待开始' }}</span
			><a-checkbox
				v-model="browser.checked"
				:aria-label="`选择 ${browser.name}`"
			/>
		</div>
		<a-input
			v-if="browser.renaming"
			ref="renameInput"
			v-model="renameValue"
			aria-label="浏览器名称"
			@press-enter="finishRename"
			@blur="finishRename"
		/>
		<button
			v-else
			class="space-name"
			@click="browser.select()"
		>
			{{ browser.name }}<span>↗</span>
		</button>
		<p class="space-notes">{{ browser.notes || '一个独立的账号与课程环境，让学习井井有条。' }}</p>
		<div class="space-tags">
			<span
				v-for="tag in browser.tags.slice(0, 3)"
				:key="tag.name"
				class="dew-pill"
				>{{ tag.name }}</span
			><span
				v-if="!browser.tags.length"
				class="dew-pill"
				>独立空间</span
			><span class="space-script-count">{{ browser.automationScripts.length }} 个自动程序</span>
		</div>
		<div class="space-actions"><BrowserOperators :browser="browser" /><EntityOperator :entity="browser" /></div>
	</article>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { Browser } from '../../fs/browser';
import { Process } from '../../utils/process';
import { embeddedBrowsers } from '../../composables/useEmbeddedBrowsers';
import Icon from '../Icon.vue';
import BrowserOperators from './BrowserOperators.vue';
import EntityOperator from '../EntityOperator.vue';
const props = defineProps<{ browser: Browser }>();
const running = computed(
	() => embeddedBrowsers.includes(props.browser.uid) || Process.from(props.browser.uid)?.status === 'launched'
);
const renameValue = ref(props.browser.name);
const renameInput = ref<{ $el: HTMLElement }>();
watch(
	() => props.browser.renaming,
	async (renaming) => {
		renameValue.value = props.browser.name;
		if (renaming) {
			await nextTick();
			const input = renameInput.value?.$el.querySelector('input');
			input?.focus();
			input?.select();
		}
	}
);
function finishRename() {
	if (props.browser.renaming) props.browser.rename(renameValue.value.trim() || props.browser.name);
}
</script>
