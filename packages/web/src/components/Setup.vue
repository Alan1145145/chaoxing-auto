<template>
	<a-modal
		modal-class="setup-modal"
		:width="620"
		:visible="props.visible"
		:footer="false"
		:closable="false"
		:unmount-on-close="true"
		@close="
			() => {
				emits('update:visible', false);
			}
		"
	>
		<template #title> {{ props.title }} </template>
<div class="setup-intro"><span>✳</span><div><h3>让学习环境，一次准备好。</h3><p>跟随步骤配置浏览器、脚本与课程环境。</p></div></div>
		<a-row :gutter="[24, 24]">
			<a-col v-if="!Environment.infos.value">
				<template v-if="Environment.loading">
					<div class="text-center">
						<a-spin />
						<div class="mt-2">正在初始化资源，请稍后...</div>
					</div>
				</template>
				<template v-else>
					<div class="text-center text-danger">未能获取到远程资源信息，请检查网络后重试，或者稍后手动设置。</div>
				</template>
			</a-col>
			<a-col
				v-else
				class="text-center"
			>
				<a-steps
					direction="vertical"
					:current="state.current_step"
				>
					<template
						v-for="(step, index) in state.steps"
						:key="index"
					>
						<a-step
							v-show="!step.hidden"
							:status="step.status"
						>
							<template
								v-if="step.status"
								#icon
							>
								<icon-check-circle
									v-if="step.status === 'finish'"
									style="color: green; font-size: 28px"
									class="finish-check-animate"
								/>
								<icon-close-circle
									v-else-if="step.status === 'error'"
									style="font-size: 28px; background-color: white"
								/>
								<icon-refresh
									v-else-if="step.status === 'process'"
									style="font-size: 28px; color: gray"
									spin
								/>
							</template>

							<template #description>
								<div
									v-if="step.error"
									class="text-danger"
								>
									{{ step.error }}
								</div>
								<div
									v-else-if="step.description"
									style="white-space: pre-wrap; text-align: left; font-size: 12px"
								>
									{{ step.description }}
								</div>
							</template>
							{{ step.title }}
						</a-step>
					</template>
				</a-steps>
			</a-col>
			<a-col class="text-center mt-2">
				<a-space :size="24">
					<template v-if="state.current_step === state.steps.length">
						<a-button
							type="primary"
							size="small"
							:disabled="props.autoSetup && state.finish_animate"
							@click="
								() => {
									emits('update:visible', false);
								}
							"
						>
							<template v-if="props.autoSetup && state.finish_animate">
								<icon-check-circle-fill
									style="color: greenyellow"
									class="finish-check-animate me-2"
								/>
								已完成
							</template>
							<template v-else>完成！</template>
						</a-button>
					</template>
					<template v-else-if="state.current_step === -1 || state.steps.find((s) => s.status === 'error')">
						<a-button
							size="small"
							@click="() => emits('update:visible', false)"
						>
							{{ props.cancelText }}
						</a-button>
						<a-button
							type="primary"
							size="small"
							@click="setup"
						>
							{{ props.confirmText }}
						</a-button>
					</template>
					<template v-else>
						<a-button
							size="small"
							:disabled="true"
						>
							<icon-loading /> 初始化中...
						</a-button>
					</template>
				</a-space>
			</a-col>
		</a-row>

		<!-- 浏览器名称输入弹窗 -->
		<a-modal
			v-model:visible="setupState.showBrowserNameInput"
			:footer="false"
			unmount-on-close
			:mask-closable="false"
			:closable="false"
		>
			<template #title> 新建浏览器 </template>
			<div class="text-secondary mb-2">请输入浏览器名称：</div>
			<a-input
				v-model="setupState.browserName"
				size="small"
				placeholder="请输入浏览器名称"
				@press-enter="onBrowserNameConfirm"
			></a-input>
			<div class="d-flex justify-content-end mt-2">
				<a-space>
					<a-button
						size="small"
						@click="skipBrowserNameInput"
					>
						跳过
					</a-button>
					<a-button
						type="primary"
						size="small"
						@click="onBrowserNameConfirm"
					>
						确定
					</a-button>
				</a-space>
			</div>
		</a-modal>

		<!-- 自动化程序选择弹窗 -->
		<a-modal
			v-model:visible="setupState.showScriptSelector"
			:footer="false"
			unmount-on-close
			:mask-closable="false"
			:closable="false"
		>
			<template #title> 选择自动化程序 </template>
			<div class="d-flex justify-content-between align-items-center mb-2">
				<span style="font-size: 12px">请选择需要添加到新建浏览器的自动化程序</span>
				<a-button
					size="mini"
					type="text"
					@click="skipScriptSelector"
				>
					跳过此步骤
				</a-button>
			</div>
			<AutomationScriptSelector
				:automation-scripts="[]"
				@confirm="onSelectorConfirm"
			></AutomationScriptSelector>
		</a-modal>

		<!-- 自动化程序配置弹窗 -->
		<a-modal
			v-model:visible="setupState.showScriptConfig"
			:footer="false"
			unmount-on-close
			:mask-closable="false"
			:closable="false"
			:width="620"
		>
			<template #title> 填写自动化程序配置 </template>
			<div class="text-secondary mb-2">请填写所选自动化程序的配置信息</div>
			<div style="max-height: 60vh; overflow: overlay">
				<a-empty v-if="setupState.configScripts.length === 0" />
				<AutomationScriptList
					v-else
					v-model:automation-scripts="setupState.configScripts"
				></AutomationScriptList>
			</div>
			<div class="d-flex justify-content-end mt-2">
				<a-space>
					<a-button
						size="small"
						@click="skipScriptConfig"
					>
						跳过
					</a-button>
					<a-button
						type="primary"
						size="small"
						@click="onConfigConfirm"
					>
						保存配置
					</a-button>
				</a-space>
			</div>
		</a-modal>
	</a-modal>
</template>

<script setup lang="ts">
import { lang, store } from '../store';
import { sleep } from '../utils';
import { remote } from '../utils/remote';
import { reactive, watch, nextTick, onMounted } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { installExtensions } from '../utils/extension';
import { addScriptFromUrl } from '../utils/user-scripts';
import { Environment } from '../utils/environment';
import { getDefaultBrowserName, newBrowser } from '../utils/browser';
import { Browser } from '../fs/browser';
import AutomationScriptSelector from './automation-scripts/AutomationScriptSelector.vue';
import AutomationScriptList from './automation-scripts/AutomationScriptList.vue';
import type { RawAutomationScript } from './automation-scripts';

type Step = {
	title: string;
	description?: string;
	error?: string;
	status?: 'wait' | 'process' | 'finish' | 'error';
	hidden?: boolean;
	action: (step: Step) => any;
};

const _preset_steps = {
	show_desc: {
		title: '等待初始化...',
		description: lang('setup_modal_notice', ''),
		action() {}
	} as Step,
	init_env: {
		title: '初始化环境',
		async action(step) {
			step.description = '正在检测可用浏览器...';

			const valid_version_browser = await Environment.getSupportedBrowser();
			if (valid_version_browser) {
				store.render.setting.launchOptions.executablePath = valid_version_browser.path;
				step.description += `\n设置浏览器路径为： ${valid_version_browser.name} - ${valid_version_browser.path}`;
				return;
			}

			// 原版此处会从 OCS 官方服务器下载“最新版本软件”安装包并直接运行，会用原版覆盖本软件，已停用。
			step.error =
				'未找到可用的浏览器（需要 137 及以下版本的 Chrome/Edge，或软件内置浏览器）。\n' +
				'超星自动机已关闭在线更新，不会自动下载其他版本软件。\n' +
				'请在「设置 → 浏览器路径」中选择「软件内置」浏览器；如果内置浏览器缺失，请重新运行超星自动机安装包安装。';
		}
	} as Step,
	init_extensions: {
		title: '初始化浏览器拓展',
		async action(step) {
			step.description = '正在获取远程资源信息...';
			// 获取最新的拓展和用户脚本信息
			const extensions = await Environment.getExtensions();

			const install_new = async () => {
				const default_extension = extensions[0];
				if (!default_extension) {
					step.error = '未检测到可用脚本管理器拓展，请尝试重启软件。';
					return;
				}
				step.description += `\n共检测到 ${extensions.length} 个脚本管理器拓展，正在安装...`;
				const default_extension_filepath = await installExtensions(extensions, default_extension, {
					force_install: true
				});
				if (!default_extension_filepath) {
					step.error = '脚本管理器安装失败，请稍后重试，或者稍后在左侧应用中心手动安装。';
					return;
				}
				step.description += `\n已安装脚本管理器：${default_extension.name} - ${default_extension.url}`;
			};

			// 如果全部都没安装则安装第一个
			if (!extensions.every((ext) => ext.installed)) {
				return install_new();
			}
			// 如果版本不支持
			const supported_extension = await Environment.getSupportedExtension();

			// 检查是否为 MV2 拓展，如果是则报错
			if (!supported_extension) {
				step.description = lang(
					'setup_error_auto_download_new_extension_when_version_too_low',
					'当前脚本管理器版本较低，需要更新拓展到最新MV3版本'
				);
				try {
					await new Promise<void>((resolve, reject) => {
						Modal.confirm({
							title: '警告',
							content: step.description || '',
							maskClosable: false,
							closable: false,
							cancelText: '取消',
							okText: '一键更新',
							onCancel(e) {
								reject(new Error('你已取消更新，请自行在左侧应用中心更新拓展或者重新初始化。'));
							},
							async onOk() {
								await install_new();
								resolve();
							}
						});
					});
				} catch (err) {
					step.error = String(err);
					return;
				}
				return;
			}
			step.description = `已安装脚本管理器：${supported_extension.name} - ${supported_extension.url}`;
		}
	} as Step,
	new_browser: {
		title: '新建浏览器',
		async action(step) {
			await sleep(500);
			step.description = '请输入浏览器名称...';
			// 弹出名称输入弹窗，默认值来自 newBrowser 的命名生成算法
			const name = await onInputBrowserName();
			step.description = `正在创建浏览器：${name}...`;

			const browser = newBrowser({ name });
			if (!browser) {
				step.error = '浏览器创建失败，请确保已在左侧软件设置中配置浏览器路径。';
				return;
			}
			setupState.newBrowserInstance = browser;
			step.description = `已创建浏览器：${browser.name}，可在浏览器列表中查看并重命名。`;
		}
	} as Step,
	init_automationScript: {
		title: '添加自动化程序',
		async action(step) {
			await sleep(500);
			step.description = '请选择需要添加的自动化程序...';
			const selected = await openScriptSelector();
			// 未选择则跳过此步骤
			if (!selected || selected.length === 0) {
				step.description = '已跳过自动化程序添加。';
				return;
			}
			// 紧接着弹出配置弹窗，提示用户填写配置信息
			setupState.configScripts = JSON.parse(JSON.stringify(selected));
			const configured = await openScriptConfig();
			if (configured && configured.length && setupState.newBrowserInstance) {
				setupState.newBrowserInstance.automationScripts = configured;
				step.description = `已为浏览器「${setupState.newBrowserInstance.name}」添加 ${configured.length} 个自动化程序。`;
			} else {
				step.description = '未保存自动化程序配置，已跳过。';
			}
		}
	} as Step,
	init_script: {
		title: '初始化脚本',
		async action(step) {
			const default_user_script = await Environment.getValidUserScript();
			if (!default_user_script) {
				step.error = '未检测到可用脚本，请稍后在左侧软件设置中设置。';
				return;
			}
			step.description = `正在安装默认脚本：` + default_user_script.name;
			await addScriptFromUrl(default_user_script.url);
			step.description = `已安装用户脚本：${default_user_script.name} - ${default_user_script.url}`;
		}
	} as Step
};

const props = withDefaults(
	defineProps<{
		visible: boolean;
		confirmText?: string;
		cancelText?: string;
		title?: string;
		autoSetup?: boolean;
		presetSteps?: (keyof typeof _preset_steps)[];
	}>(),
	{
		visible: false,
		confirmText: '一键初始化',
		cancelText: '稍后手动设置',
		title: '初始化软件设置',
		autoSetup: false,
		presetSteps: () => [
			'show_desc',
			'init_env',
			'new_browser',
			'init_extensions',
			'init_automationScript',
			'init_script'
		]
	}
);

const state = reactive({
	current_step: -1,
	finish_animate: false,
	steps: [] as Step[]
});

/** 新建浏览器与自动化程序交互状态 */
const setupState = reactive({
	showScriptSelector: false,
	showScriptConfig: false,
	showBrowserNameInput: false,
	/** 浏览器名称输入弹窗的当前值 */
	browserName: '',
	/** 用户已选中的自动化程序（用于配置弹窗编辑） */
	configScripts: [] as RawAutomationScript[],
	/** 新建的浏览器实例 */
	newBrowserInstance: null as Browser | null
});

/** 弹窗的 Promise resolve 回调（非响应式，无需放入 reactive） */
let selectorResolver: ((v: RawAutomationScript[] | null) => void) | null = null;
let configResolver: ((v: RawAutomationScript[] | null) => void) | null = null;
let browserNameResolver: ((v: string) => void) | null = null;

/** 弹出浏览器名称输入弹窗，默认值为命名算法生成的默认名；返回用户确认的名称（跳过则返回默认名） */
function onInputBrowserName(): Promise<string> {
	setupState.browserName = getDefaultBrowserName();
	return new Promise((resolve) => {
		browserNameResolver = resolve;
		setupState.showBrowserNameInput = true;
	});
}

function onBrowserNameConfirm() {
	const name = setupState.browserName.trim() || getDefaultBrowserName();
	setupState.showBrowserNameInput = false;
	if (browserNameResolver) {
		browserNameResolver(name);
		browserNameResolver = null;
	}
}

function skipBrowserNameInput() {
	setupState.showBrowserNameInput = false;
	if (browserNameResolver) {
		browserNameResolver(getDefaultBrowserName());
		browserNameResolver = null;
	}
}

/** 弹出自动化程序选择弹窗，返回用户选择的脚本（跳过/未选时返回 null） */
function openScriptSelector(): Promise<RawAutomationScript[] | null> {
	return new Promise((resolve) => {
		selectorResolver = resolve;
		setupState.showScriptSelector = true;
	});
}

function onSelectorConfirm(scripts: RawAutomationScript[]) {
	setupState.showScriptSelector = false;
	if (selectorResolver) {
		selectorResolver(scripts && scripts.length ? scripts : null);
		selectorResolver = null;
	}
}

function skipScriptSelector() {
	setupState.showScriptSelector = false;
	if (selectorResolver) {
		selectorResolver(null);
		selectorResolver = null;
	}
}

/** 弹出自动化程序配置弹窗，返回填写完成的脚本（跳过时返回 null） */
function openScriptConfig(): Promise<RawAutomationScript[] | null> {
	return new Promise((resolve) => {
		configResolver = resolve;
		setupState.showScriptConfig = true;
	});
}

function onConfigConfirm() {
	setupState.showScriptConfig = false;
	if (configResolver) {
		configResolver(JSON.parse(JSON.stringify(setupState.configScripts)));
		configResolver = null;
	}
}

function skipScriptConfig() {
	setupState.showScriptConfig = false;
	if (configResolver) {
		configResolver(null);
		configResolver = null;
	}
}

const emits = defineEmits<{
	(e: 'finish'): void;
	(e: 'error', err: string): void;
	(e: 'update:visible', data: any): void;
}>();

onMounted(() => {
	nextTick(async () => {
		await Environment.init();
		prepare();
		if (props.autoSetup) {
			setup();
		}
	});
});

watch(
	() => props.visible,
	(vis) => {
		nextTick(async () => {
			await Environment.init();
			prepare();
			if (props.autoSetup) {
				setup();
			}
		});
	}
);

function prepare() {
	state.current_step = -1;
	state.steps = [];
	state.finish_animate = false;
	setupState.showScriptSelector = false;
	setupState.showScriptConfig = false;
	setupState.showBrowserNameInput = false;
	setupState.browserName = '';
	setupState.configScripts = [] as RawAutomationScript[];
	setupState.newBrowserInstance = null as Browser | null;

	for (const key in _preset_steps) {
		if (!Object.hasOwn(_preset_steps, key)) continue;
		const step: Step = Reflect.get(_preset_steps, key);
		step.status = 'wait';
	}
	for (const key of props.presetSteps) {
		state.steps.push(Reflect.get(_preset_steps, key));
	}
}

async function setup() {
	state.current_step = 0;
	try {
		for (const step of state.steps) {
			step.status = 'wait';
			step.error = '';
		}
		let error = false;
		for (const step of state.steps) {
			if (error) {
				step.hidden = true;
				continue;
			}
			step.status = 'process';
			await step.action(step);
			if (step.error) {
				step.status = 'error';
				error = true;
			} else {
				step.status = 'finish';
			}
			state.current_step += 1;
			await sleep(200);
		}
		if (state.steps.every((s) => s.status === 'finish')) {
			state.steps.push({
				title: '初始化完成',
				status: 'finish',
				async action(step) {
					step.description = lang('setup_finish_notice', '');
				}
			});
			state.current_step += 1;
			state.finish_animate = true;
			await sleep(1000);
			emits('finish');
		}
	} catch (err) {
		console.error(err);
		Message.error('初始化失败 : ' + err);
		emits('error', String(err));
	}
}
</script>

<style scoped lang="less">
:deep(.arco-steps-vertical .arco-steps-item:not(:last-child)) {
	min-height: 42px;
}

/* 完成反馈：打勾图标旋转一圈后定格，时长 200ms */
.finish-check-animate {
	display: inline-block;
	animation: finish-check-rotate 500ms linear forwards;
}

@keyframes finish-check-rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

// 透明化步骤图标背景，自由设置
:deep(.arco-steps-icon) {
	background-color: white !important;
}

:deep(.arco-steps-item-wait .arco-steps-icon, .arco-steps-item-process .arco-steps-icon) {
	background-color: rgb(229, 229, 229) !important;
}
</style>
