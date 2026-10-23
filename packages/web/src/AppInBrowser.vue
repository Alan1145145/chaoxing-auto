<template>
	<router-view v-if="$route.name === 'bookmarks'" />
	<div
		v-else
		class="browser-preview-shell"
	>
		<AppNavigation />
		<div class="workspace-main">
			<WorkspaceHeader />
			<div class="workspace-route">
				<router-view v-slot="{ Component }">
					<keep-alive>
						<component
							:is="Component"
							:key="$route.matched[0]?.path"
						/>
					</keep-alive>
				</router-view>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import AppNavigation from './components/AppNavigation.vue';
import WorkspaceHeader from './components/WorkspaceHeader.vue';
</script>

<style lang="less">
@import '@/assets/css/bootstrap.min.css';
@import '@/assets/css/common.css';
.browser-preview-shell {
	display: flex;
	height: 100vh;
	background: var(--dew-bg);
}
</style>
