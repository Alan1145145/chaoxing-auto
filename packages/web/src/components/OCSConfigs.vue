<!-- eslint-disable max-len -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
	<div>
		<template v-if="state.err">
			<div class="d-inline-block p-5">
				<a-result
					title="解析错误！请尝试重启软件"
					:subtitle="'原因：' + state.err"
					status="error"
				>
				</a-result>
			</div>
		</template>
		<template v-else-if="state.loading">
			<div class="p-5 text-center">
				<a-spin tip="正在获取最新OCS配置..." />
			</div>
		</template>

		<template v-else>
			<div
				style="position: sticky; top: 0px; z-index: 99"
				class="ocs-config-toolbar pb-2"
			>
				<a-alert class="mb-2">
					<span
						v-html="
							lang(
								'setting_ocs_sync_notes',
								'选择不同平台进行脚本设置，然后开启同步即可全浏览器应用相同OCS脚本设置 <br /> 如果只有单个浏览器，则无需配置，直接前往浏览器设置即可。'
							)
						"
					></span>
				</a-alert>

				<a-tabs
					v-model:active-key="Store.render.setting.ocs.currentProjectName"
					type="rounded"
					hide-content
				>
					<a-tab-pane
						v-for="project of state.projects
							.filter((p) => !state.hidden_projects.includes(p.name))
							.sort((a, b) => (a.name === state.pin_projects ? -1 : 1))"
						:key="project.name"
						:title="project.name"
					>
					</a-tab-pane>
				</a-tabs>
			</div>
			<div
				id="ocs-browser-configs"
				class="mt-3 ps-2 pe-2"
			></div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, onActivated, reactive, watch, ref, WatchStopHandle, onDeactivated } from 'vue';
import { remote } from '../utils/remote';
import { store as Store, lang } from '../store/index';
import * as OCSJS from '@ocsjs/scripts';
import * as EUS from 'easy-us';
import type { Project } from 'easy-us';
import configTheme from '../assets/css/ocs-config-theme.css?raw';

const props = defineProps<{
	store: object;
}>();

const store = ref(props.store);

const emits = defineEmits<{
	(e: 'update:store', val: object): void;
	(e: 'update:project', val: Project[]): void;
	(e: 'loading'): void;
	(e: 'loaded'): void;
	(e: 'error', err: string): void;
}>();

const state = reactive({
	css: '',
	/** 是否加载 */
	loading: false,
	/** 是否报错 */
	err: '',
	/** 当前选中的 ocs project */
	projects: [] as Project[],
	watchStopHandle: undefined as WatchStopHandle | undefined,
	hidden_projects: ['后台'],
	pin_projects: '通用',
	hidden_scripts: ['common.online-search', 'common.work-results']
});

watch(
	() => [Store.render.setting.ocs.currentProjectName],
	() => {
		nextTick(renderOCS);
	}
);

state.watchStopHandle = watch(store, () => {
	emits('update:store', store.value);
});

let wrapper = null as HTMLElement | null;
let root = null as ShadowRoot | null;

/** 设置手风琴效果：同时只能打开一个 detail */
function setupAccordion(detailsList: HTMLDetailsElement[]) {
	for (const details of detailsList) {
		details.addEventListener('toggle', () => {
			if (details.open) {
				for (const other of detailsList) {
					if (other !== details && other.open) {
						other.removeAttribute('open');
					}
				}
			}
		});
	}
}

function renderOCS() {
	if (!root || !wrapper) return;
	const { definedCustomElements, h, $, $ui, $store } = EUS;

	try {
		const project = state.projects.find((p) => p.name === Store.render.setting.ocs.currentProjectName);

		// 清空元素
		root.replaceChildren();

		loadCustomElements(definedCustomElements as any[]);

		root.append(h('style', state.css));

		// Global styles cannot cross this closed shadow root.
		root.append(h('style', configTheme));

		if (project) {
			const detailsList: HTMLDetailsElement[] = [];
			let i = 0;
			for (const key in project.scripts) {
				if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
					const script = project.scripts[key];

					if (script.namespace && state.hidden_scripts.includes(script.namespace)) {
						continue;
					}

					/** 为对象添加响应式特性，在设置值的时候同步到本地存储中 */
					script.cfg = Object.keys(script.cfg).length === 0 ? $.createConfigProxy(script) : script.cfg;
					const { notes, ...otherConfigs } = script.configs || {};

					if (
						script.namespace &&
						// 如果没有配置项，则不显示
						Object.keys(otherConfigs).filter((k) => otherConfigs[k].label !== undefined).length &&
						script.hideInPanel !== false
					) {
						const details = h('details', { open: i === 0 });
						const panel = $ui.scriptPanel(script, $store);
						details.append(h('summary', panel.name || '未知脚本'));
						details.append(panel);
						/** 添加到页面中，并执行 onrender 函数 */
						root.append(details);
						detailsList.push(details);
						i++;
						try {
							script.onrender?.({ panel, header: h('header-element') });
						} catch (err) {
							console.error(err);
						}
					}
				}
			}

			/** 初始化手风琴效果 */
			setupAccordion(detailsList);

			/** 挂载 ocs panel */
			document.querySelector('#ocs-browser-configs')?.replaceChildren(wrapper);
		}
	} catch (err) {
		state.err = String(err);
		console.error(err);
	}
}

async function loadOCS() {
	state.loading = true;
	emits('loading');
	try {
		if (state.css === '') {
			state.css = await remote.methods.call('get', `http://localhost:${Store.server.port || 15319}/ocsjs/style.css`);
		}

		const OCS = OCSJS;
		const { MemoryStoreProvider, $elements, h } = EUS;

		wrapper = wrapper || h('div');
		root = root || wrapper.attachShadow({ mode: 'closed' });

		OCS.$elements.root = root;
		$elements.root = root;

		/** 双向绑定数据 */
		MemoryStoreProvider._source.store = store.value;

		state.projects = OCS.definedProjects();
		emits('update:project', state.projects as Project[]);
		if (!Store.render.setting.ocs.currentProjectName) {
			Store.render.setting.ocs.currentProjectName = state.projects[0].name;
		}
	} catch (err) {
		state.err = String(err);
		console.error(err);
		emits('error', String(err));
	}

	state.loading = false;
	emits('loaded');
}

onMounted(() => {
	nextTick(async () => {
		await loadOCS();
		renderOCS();
	});
});

onActivated(() => {
	nextTick(async () => {
		await loadOCS();
		renderOCS();
	});
});

onDeactivated(() => {
	state.watchStopHandle?.();
});

/** 加载自定义元素 */
function loadCustomElements(elements: { new (): HTMLElement }[]) {
	for (const element of elements) {
		const name = resolveCustomElementName(element, '-');
		// 不能重复加载
		if (customElements.get(name) === undefined) {
			customElements.define(name, element);
		}
	}
}

/**
 * 将每个驼峰前面添加目标字符串，用于自定义元素名的转换
 * @param el  自定义元素
 * @param target 目标字符串
 */
function resolveCustomElementName<T extends HTMLElement = HTMLElement>(el: { new (): T }, target: string) {
	return el.name
		.replace(/([A-Z])/g, target + '$1')
		.toLowerCase()
		.split(target)
		.slice(1)
		.join(target);
}
</script>

<style scoped lang="less">
.ocs-config-toolbar {
	background: var(--dew-surface);
}
#ocs-browser-configs {
	overflow: overlay;
	height: calc(100% - 64px);
}

.script-panels {
}
</style>
