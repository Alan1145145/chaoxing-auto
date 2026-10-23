<!-- eslint-disable vue/no-v-html -->
<template>
	<div class="dew-page scripts-page">
		<PageIntro eyebrow="LESS REPETITION, MORE FOCUS" title="让重复的事，轻一点。" description="管理用户脚本，为每个学习空间配置合适的自动化能力。" />
		<div class="dew-card"><UserScriptListPage /></div>
	</div>
</template>

<script setup lang="ts">
import PageIntro from '../../components/PageIntro.vue';
import UserScriptListPage from '../../components/UserScriptListPage.vue';
</script>

<style scoped lang="less"></style>
