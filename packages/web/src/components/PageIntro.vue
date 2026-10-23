<template>
	<header class="dew-heading">
		<div>
			<div class="dew-eyebrow">{{ eyebrow }}</div>
			<h1>{{ title }}</h1>
			<p>{{ description }}</p>
		</div>
		<slot />
	</header>
</template>
<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description: string }>();
</script>
