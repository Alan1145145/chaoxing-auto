<template>
	<div class="dew-page workbench">
		<header class="dew-heading">
			<div>
				<div class="dew-eyebrow">YOUR LEARNING, IN FOCUS</div>
				<h1>每一点进步，都看得见。</h1>
				<p>课程、题库和你的 AI 助手，在这里有序连接。</p>
			</div>
			<button
				class="dew-button secondary"
				@click="router.push('/browsers')"
			>
				<Icon type="add" />打开学习空间
			</button>
		</header>
		<div class="overview-grid">
			<section class="focus-panel dew-card">
				<div class="dew-card-title">专注于今天 <span class="dew-pill">STUDY SPACE</span></div>
				<div
					class="study-object"
					aria-hidden="true"
				>
					<div class="soft-glow" />
					<svg
						viewBox="0 0 440 330"
						role="img"
						aria-label="翻开的学习笔记"
					>
						<defs>
							<linearGradient
								id="pageLeft"
								x1="0"
								x2="1"
							>
								<stop stop-color="#d7dace" />
								<stop
									offset=".72"
									stop-color="#fafbf5"
								/>
								<stop
									offset="1"
									stop-color="#c5cbb9"
								/>
							</linearGradient>
							<linearGradient
								id="pageRight"
								x1="0"
								x2="1"
							>
								<stop stop-color="#d9decb" />
								<stop
									offset=".22"
									stop-color="#fffef5"
								/>
								<stop
									offset="1"
									stop-color="#eeeedf"
								/>
							</linearGradient>
							<filter id="bookShadow"><feGaussianBlur stdDeviation="13" /></filter>
						</defs>
						<ellipse
							cx="224"
							cy="277"
							rx="131"
							ry="16"
							fill="#646f41"
							opacity=".14"
							filter="url(#bookShadow)"
						/>
						<g transform="translate(20,12) rotate(-9 210 160)">
							<path
								d="M62 91Q129 55 208 91L358 78L357 244Q285 229 210 266Q138 228 62 235Z"
								fill="#a5ae8b"
							/>
							<path
								d="M69 79Q137 49 207 88L207 253Q137 214 69 224Z"
								fill="url(#pageLeft)"
							/>
							<path
								d="M207 88Q274 48 351 69L351 231Q278 212 207 253Z"
								fill="url(#pageRight)"
							/>
							<g
								stroke="#b9c0ab"
								stroke-width="2"
								fill="none"
								opacity=".55"
							>
								<path
									d="M92 109Q138 95 182 116M92 128Q138 114 182 135M92 148Q138 134 182 155M92 168Q138 154 182 175M92 188Q138 174 161 189"
								/>
								<path
									d="M232 109Q273 89 326 98M232 128Q273 108 326 117M232 148Q273 128 326 137M232 168Q273 148 326 157M232 188Q273 168 307 174"
								/>
							</g>
							<path
								d="M286 68L285 143L300 129L315 137L314 66"
								fill="#8b9868"
							/>
							<path
								d="M208 89V252"
								stroke="#a9b18f"
								fill="none"
							/>
						</g>
					</svg>
					<span class="object-tag tag-top"><i />课程空间</span><span class="object-tag tag-left"><i />本地题库</span
					><span class="object-tag tag-right"><i />豆包 AI</span>
				</div>
				<div class="focus-caption">
					<span>保持好奇，慢慢积累。</span
					><button
						class="dew-link"
						@click="router.push('/doubao')"
					>
						和豆包聊聊 ↗
					</button>
				</div>
			</section>
			<section class="score-card dew-card">
				<div class="dew-card-title">你的知识积累 <span>↗</span></div>
				<div class="knowledge-count">{{ questionCount ?? '—' }}<span>道题</span></div>
				<div class="score-bottom">
					<span>本地题库 · 持续积累</span
					><button
						@click="router.push('/library')"
						aria-label="查看本地题库"
					>
						↗
					</button>
				</div>
			</section>
			<section class="assistant-card dew-card">
				<div class="dew-card-title">下一步 <small>AI ASSISTANT</small></div>
				<h2>让问题，有解。</h2>
				<p>登录豆包，让学习多一个帮手。</p>
				<div class="assistant-status"><i :class="{ online: loggedIn }" />{{ statusText }}</div>
				<button
					class="dew-button"
					@click="router.push('/doubao')"
				>
					{{ loggedIn ? '开始提问' : '连接豆包' }}<span>↗</span>
				</button>
			</section>
			<section class="resources-card dew-card">
				<div class="dew-card-title">学习资源 <small>OVERVIEW</small></div>
				<div
					v-for="item in resourceStats"
					:key="item.label"
					class="resource-row"
				>
					<span>{{ item.label }}</span>
					<div class="resource-track"><i :style="{ width: item.value ? '100%' : '4%' }" /></div>
					<strong>{{ item.value }}</strong>
				</div>
				<button
					class="dew-link"
					@click="router.push('/resources')"
				>
					探索应用中心 ↗
				</button>
			</section>
			<section class="path-card dew-card">
				<div class="dew-card-title">把学习串起来 <small>WORKFLOW</small></div>
				<button
					v-for="(step, index) in steps"
					:key="step.path"
					class="path-step"
					@click="router.push(step.path)"
				>
					<span class="step-number">0{{ index + 1 }}</span
					><span
						>{{ step.title }}<small>{{ step.desc }}</small></span
					><span class="step-arrow">↗</span>
				</button>
			</section>
			<section class="sessions-card dew-card">
				<div class="dew-card-title">
					最近的学习空间
					<button
						class="dew-link"
						@click="router.push('/browsers')"
					>
						全部 ↗
					</button>
				</div>
				<div
					v-if="!browsers.length"
					class="session-empty"
				>
					<Icon type="tab" /><span>从第一个学习空间开始</span
					><button
						class="dew-button secondary"
						@click="store.render.state.newBrowserSetup = true"
					>
						新建浏览器
					</button>
				</div>
				<button
					v-for="browser in browsers.slice(0, 4)"
					:key="browser.uid"
					class="session-row"
					@click="router.push('/browsers')"
				>
					<span class="session-icon"><Icon type="language" /></span
					><span
						>{{ browser.name }}<small>{{ browser.notes || '独立课程与脚本环境' }}</small></span
					><span>↗</span>
				</button>
			</section>
			<section class="note-card dew-card">
				<div class="dew-card-title">一点小提示 <span>✳</span></div>
				<h3>理解，比记住更进一步。</h3>
				<p>让豆包解释思路，再把值得保留的答案收进题库。AI 生成的内容可在复习时核对。</p>
				<button
					class="dew-link"
					@click="router.push('/doubao')"
				>
					去问一个问题 ↗
				</button>
			</section>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, onActivated, ref } from 'vue';
import { useRouter } from 'vue-router';
import { root } from '@/fs/folder';
import { Browser } from '@/fs/browser';
import { store } from '@/store';
import { processes } from '@/utils/process';
import { remote } from '@/utils/remote';
import { inBrowser } from '@/utils/node';
import Icon from '@/components/Icon.vue';
const router = useRouter();
const browsers = computed(() => root().findAll<'browser', Browser>((entity) => entity.type === 'browser'));
const questionCount = ref<number | null>(null);
const loggedIn = ref(false);
const statusText = ref('尚未连接');
const resourceStats = computed(() => [
	{ label: '浏览器空间', value: browsers.value.length },
	{ label: '运行中的空间', value: processes.filter((p) => p.status === 'launched').length },
	{ label: '已安装脚本', value: store.render.scripts.length }
]);
const steps = [
	{ title: '连接豆包', desc: '扫码或使用官方账号登录', path: '/doubao' },
	{ title: '选择答题模型', desc: '设置模型并连接课程脚本', path: '/question-bank' },
	{ title: '打开课程空间', desc: '进入课程，继续今天的学习', path: '/browsers' }
];
onActivated(async () => {
	if (inBrowser) {
		statusText.value = '请在桌面端连接';
		return;
	}
	try {
		questionCount.value = (await remote.methods.call('listQuestionBankQuestions', { pageSize: 1 })).total;
	} catch {}
	try {
		const status = await remote.methods.call('getDoubaoStatus');
		loggedIn.value = status.loggedIn;
		statusText.value = status.loggedIn ? '已连接 · 凭据已保存' : '尚未登录';
	} catch {
		statusText.value = '网关未就绪';
	}
});
</script>
<style scoped src="./style.css"></style>
