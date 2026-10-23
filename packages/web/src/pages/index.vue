<template>
	<CommonEditActionDropdown
		trigger="contextMenu"
		align-point
		position="bl"
		:style="{ display: 'block', height: '100%' }"
	>
		<div class="h-100 w-100 overflow-auto">
			<router-view v-slot="{ Component }">
				<Transition name="page-swap" mode="out-in" appear>
					<keep-alive><component :is="Component" :key="$route.name" /></keep-alive>
				</Transition>
			</router-view>
		</div>
	</CommonEditActionDropdown>
</template>

<script setup lang="ts">
import CommonEditActionDropdown from '../components/CommonEditActionDropdown.vue';
</script>
