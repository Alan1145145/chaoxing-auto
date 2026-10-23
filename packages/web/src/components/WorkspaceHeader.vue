<template>
	<header class="workspace-header">
		<div class="workspace-identity">
			<span class="workspace-symbol">✳</span><span>超星自动机 <small>让专注与灵感，在这里发生</small></span>
		</div>
		<div
			class="workspace-switcher"
			aria-label="快捷导航"
			:style="{ '--active-tab': activeTab }"
		>
			<router-link
				to="/workbench"
				:class="{ selected: activeTab === 0 }"
				>概览</router-link
			><router-link
				to="/doubao"
				:class="{ selected: activeTab === 1 }"
				>豆包助手</router-link
			><router-link
				to="/question-bank"
				:class="{ selected: activeTab === 2 }"
				>模型与题库</router-link
			>
		</div>
		<div class="workspace-date">{{ today }}<span class="workspace-avatar">AI</span></div>
	</header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const activeTab = computed(() =>
	route.name === 'doubao' ? 1 : ['question-bank', 'library'].includes(String(route.name)) ? 2 : 0
);
const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
</script>
<style scoped>
.workspace-header {
	height: 76px;
	flex-shrink: 0;
	padding: 0 30px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
}
.workspace-identity {
	display: flex;
	align-items: center;
	gap: 10px;
	color: var(--dew-text);
	font-weight: 650;
	font-size: 15px;
}
.workspace-identity small {
	display: block;
	margin-top: 3px;
	color: var(--dew-muted);
	font-size: 10px;
	font-weight: 400;
	letter-spacing: 1px;
}
.workspace-symbol {
	font-size: 26px;
	color: var(--dew-olive);
}
.workspace-switcher {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	position: relative;
	background: var(--dew-surface);
	border-radius: 24px;
	padding: 4px;
}
.workspace-switcher::before {
	content: '';
	position: absolute;
	top: 4px;
	bottom: 4px;
	left: 4px;
	width: calc((100% - 8px) / 3);
	border-radius: 22px;
	background: var(--dew-text);
	transform: translateX(calc(var(--active-tab) * 100%));
	transition: transform 320ms var(--motion-ease);
}
.workspace-switcher a {
	position: relative;
	z-index: 1;
	text-align: center;
	white-space: nowrap;
	padding: 8px 18px;
	border-radius: 20px;
	color: var(--dew-muted);
	text-decoration: none;
	font-size: 12px;
}
.workspace-switcher a.selected {
	color: var(--dew-surface);
}
.workspace-date {
	display: flex;
	align-items: center;
	gap: 16px;
	color: var(--dew-muted);
	font-size: 11px;
}
.workspace-avatar {
	border-radius: 50%;
	width: 30px;
	height: 30px;
	display: grid;
	place-items: center;
	background: var(--dew-yellow);
	color: #555c36;
	font-weight: 650;
}
@media (max-width: 1050px) {
	.workspace-date {
		display: none;
	}
	.workspace-header {
		padding: 0 20px;
	}
}
@media (max-width: 720px) {
	.workspace-identity {
		display: none;
	}
	.workspace-header {
		height: 62px;
	}
	.workspace-switcher a {
		padding: 8px 12px;
	}
}
</style>
