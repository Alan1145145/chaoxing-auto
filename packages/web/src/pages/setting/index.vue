<template>
	<div class="dew-page settings-page">
		<PageIntro eyebrow="MAKE IT YOURS" title="按你的习惯，刚刚好。" description="调整工作空间、脚本同步与本地存储偏好。" />
		<SettingPanel />
	</div>
</template>

<script setup lang="ts">
import PageIntro from '../../components/PageIntro.vue';
import SettingPanel from '../../components/SettingPanel.vue';
</script>
