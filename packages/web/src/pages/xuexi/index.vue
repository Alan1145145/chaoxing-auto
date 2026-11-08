<template>
	<div class="dew-page xuexi-page">
		<PageIntro
			eyebrow="XUEXI.CN · ONE CLICK"
			title="学习强国，一键开始学习。"
			description="打开门户即可自动阅读文章、观看视频；答题页扫码登录后自动作答，优先使用官方提示答案。"
		>
			<button
				class="dew-button secondary"
				@click="router.push('/browsers')"
			>
				管理学习空间
			</button>
		</PageIntro>

		<div class="quick-grid">
			<section class="dew-card quick-form">
				<h2>一键学习</h2>
				<p class="hint">
					网页端没有账号密码登录：阅读/视听无需登录，积分与答题需要用「学习强国」App
					扫码。出现二维码或滑块时手动完成一次，脚本会自动继续。
				</p>

				<label class="field">
					<span>打开页面</span>
					<a-select
						v-model="form.preset"
						:options="presets"
						@change="applyPreset"
						allow-clear
					/>
				</label>
				<label class="field">
					<span>起始地址</span>
					<a-input
						v-model="form.url"
						placeholder="默认打开门户并自动开始学习，也可以粘贴积分页或答题页地址"
						allow-clear
					/>
				</label>

				<div class="switches">
					<label>
						<a-switch v-model="form.autoStart" />
						<span>打开门户后自动开始阅读/视听</span>
					</label>
				</div>

				<button
					class="dew-button start-button"
					:disabled="state.starting"
					@click="startLearning"
				>
					<Icon
						type="play_arrow"
						:size="18"
					/>
					{{ state.starting ? '正在启动学习空间…' : '一键开始学习' }}
				</button>

				<ol class="steps">
					<li>打开门户：自动整理今日阅读/视听队列并开始第一篇</li>
					<li>文章缓慢滚动停留、视频静音自动播放，完成后自动接续下一篇</li>
					<li>答题：先扫码登录，再进入每日/每周/专项答题页，脚本按官方提示作答</li>
					<li>无提示的题目会用软件「模型接入」里的模型兜底（可关闭）</li>
				</ol>
			</section>

			<section class="dew-card quick-side">
				<h2>运行说明</h2>
				<div class="badge-row">
					<span class="badge">免扫码阅读</span>
					<span class="badge">官方提示优先</span>
					<span class="badge">滑块不代滑</span>
				</div>
				<ul class="notes">
					<li>阅读/视听学习在门户（www.xuexi.cn）完成，无需登录；页面自身负责学习行为上报。</li>
					<li>积分、每日/每周/专项答题在 pc.xuexi.cn，需要扫码登录；OCS 悬浮窗会在积分页与答题页出现。</li>
					<li>答题优先读取页面「提示」里的官方答案红字；没有提示时才调用 OCS 题库（内置 AI）。</li>
					<li>出现滑块验证时脚本会暂停并提示，手动完成后自动继续；脚本不伪造任何学习上报接口。</li>
				</ul>
				<div class="space-state">
					<span>学习空间</span>
					<strong>{{ existingBrowser ? existingBrowser.name : '首次点击时自动创建' }}</strong>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import { XUEXI_PLATFORM } from '@ocs-desktop/common/src/platforms';
import PageIntro from '../../components/PageIntro.vue';
import Icon from '../../components/Icon.vue';
import { root } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { newBrowser } from '../../utils/browser';

const SCRIPT_NAME = '学习强国-打开学习';
const BROWSER_NAME = '学习强国一键学习';

const PRESETS: { label: string; value: string }[] = [
	{ label: '门户 · 自动阅读/视听（免登录）', value: 'https://www.xuexi.cn/' },
	{ label: '我的积分（需扫码）', value: 'https://pc.xuexi.cn/points/my-points.html' },
	{ label: '每日答题（需扫码）', value: 'https://pc.xuexi.cn/points/exam-practice.html' },
	{ label: '每周答题列表（需扫码）', value: 'https://pc.xuexi.cn/points/exam-weekly-list.html' },
	{ label: '专项答题列表（需扫码）', value: 'https://pc.xuexi.cn/points/exam-paper-list.html' },
	{ label: '扫码登录页', value: 'https://pc.xuexi.cn/points/login.html' }
];

const router = useRouter();
const form = reactive({
	preset: PRESETS[0].value,
	url: XUEXI_PLATFORM.url,
	autoStart: true
});
const state = reactive({
	starting: false
});

const presets = PRESETS.map((preset) => ({ label: preset.label, value: preset.value }));

const existingBrowser = computed(
	() => root().findAll((entity) => entity.type === 'browser' && entity.name === BROWSER_NAME)[0] as Browser | undefined
);

function applyPreset(value: string) {
	const found = PRESETS.find((preset) => preset.value === value);
	if (found) form.url = found.value;
}

onMounted(() => {
	const entry = existingBrowser.value?.automationScripts.find((script) => script.name === SCRIPT_NAME);
	if (!entry) return;
	const configs = entry.configs || {};
	form.url = String(configs.url?.value ?? XUEXI_PLATFORM.url) || XUEXI_PLATFORM.url;
	form.autoStart = configs.autoStart?.value !== false;
	const found = PRESETS.find((preset) => preset.value === form.url);
	if (found) form.preset = found.value;
});

function buildConfigs() {
	return {
		url: {
			label: '学习强国页面地址',
			value: form.url.trim() || XUEXI_PLATFORM.url,
			type: 'text',
			required: true
		},
		autoStart: { label: '自动开始阅读/视听学习', value: form.autoStart, type: 'switch' }
	} as any;
}

async function startLearning() {
	if (state.starting) return;
	if (!form.url.trim().startsWith('http')) {
		Message.warning('起始地址需要以 http 开头。');
		return;
	}

	state.starting = true;
	try {
		let browser = existingBrowser.value;
		if (!browser) {
			browser = newBrowser({ name: BROWSER_NAME, automationScripts: [] });
			if (!browser) {
				Message.error('创建学习空间失败，请先在「软件设置」里配置浏览器路径。');
				return;
			}
		}
		browser.automationScripts = [{ name: SCRIPT_NAME, configs: buildConfigs() }];
		Message.success('正在打开学习强国学习空间，后续步骤会自动完成。');
		await browser.openInApp();
	} catch (error) {
		Message.error(`启动失败：${String(error)}`);
	} finally {
		state.starting = false;
	}
}
</script>

<style scoped lang="less">
.xuexi-page {
	max-width: 1100px;
}
.quick-grid {
	display: grid;
	grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
	gap: 18px;
	align-items: start;
}
@media (max-width: 900px) {
	.quick-grid {
		grid-template-columns: 1fr;
	}
}
.quick-form,
.quick-side {
	padding: 22px 24px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
h2 {
	margin: 0;
	font-size: 18px;
}
.hint {
	margin: 0 0 4px;
	font-size: 12px;
	line-height: 1.7;
	color: var(--dew-muted);
}
.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	font-size: 12px;
	color: var(--dew-muted);
}
.field em {
	font-style: normal;
	opacity: 0.65;
}
.switches {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 6px 0;
}
.switches label {
	display: flex;
	align-items: center;
	gap: 10px;
	font-size: 13px;
}
.start-button {
	margin-top: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
}
.steps {
	margin: 6px 0 0;
	padding-left: 18px;
	font-size: 12px;
	line-height: 1.9;
	color: var(--dew-muted);
}
.badge-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.badge {
	padding: 3px 10px;
	border-radius: 999px;
	font-size: 11px;
	background: rgba(139, 153, 99, 0.14);
	color: #6b7a44;
	border: 1px solid rgba(139, 153, 99, 0.32);
}
.notes {
	margin: 4px 0 0;
	padding-left: 18px;
	font-size: 12px;
	line-height: 1.9;
	color: var(--dew-muted);
}
.space-state {
	margin-top: auto;
	padding-top: 12px;
	border-top: 1px solid var(--dew-border);
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 12px;
	color: var(--dew-muted);
}
.space-state strong {
	font-size: 13px;
	color: var(--dew-text);
}
</style>
