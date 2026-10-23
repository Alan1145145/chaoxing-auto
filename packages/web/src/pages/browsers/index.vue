<template>
	<div
		id="browsers"
		class="browsers-page dew-page"
	>
		<PageIntro
			eyebrow="YOUR LEARNING SPACES"
			title="为专注，留一个空间。"
			description="课程与账号各有归属。选择一个空间，继续今天的学习。"
			><button
				class="dew-button"
				@click="newBrowserOrInit()"
			>
				<Icon
					type="add"
					:size="17"
				/>新建学习空间
			</button></PageIntro
		>
		<div class="metric-strip">
			<div class="metric-tile accent">
				<span
					><Icon
						type="language"
						:size="22"
				/></span>
				<div>
					<strong>{{ stats.browsers }}</strong
					><small>全部学习空间</small>
				</div>
			</div>
			<div class="metric-tile">
				<span
					><Icon
						type="play_circle"
						:size="22"
				/></span>
				<div>
					<strong>{{ runningCount }}</strong
					><small>正在运行</small>
				</div>
			</div>
			<div class="metric-tile">
				<span
					><Icon
						type="code"
						:size="22"
				/></span>
				<div>
					<strong>{{ stats.scripts }}</strong
					><small>已安装脚本</small>
				</div>
			</div>
			<div class="metric-tile">
				<span
					><Icon
						type="folder_open"
						:size="22"
				/></span>
				<div>
					<strong>{{ stats.folders }}</strong
					><small>分类文件夹</small>
				</div>
			</div>
		</div>
		<NotificationBanner class="mb-2" />
		<section class="dew-card browser-controls">
			<div class="section-toolbar">
				<div
					class="view-switch"
					aria-label="空间筛选"
				>
					<button
						:class="{ active: filter === 'all' }"
						:aria-pressed="filter === 'all'"
						@click="filter = 'all'"
					>
						全部空间</button
					><button
						:class="{ active: filter === 'running' }"
						:aria-pressed="filter === 'running'"
						@click="filter = 'running'"
					>
						运行中 {{ runningCount }}
					</button>
				</div>
				<div
					class="view-switch"
					aria-label="显示方式"
				>
					<button
						:class="{ active: view === 'cards' }"
						:aria-pressed="view === 'cards'"
						@click="view = 'cards'"
					>
						<Icon
							type="grid_view"
							:size="16"
						/>
						卡片</button
					><button
						:class="{ active: view === 'list' }"
						:aria-pressed="view === 'list'"
						@click="view = 'list'"
					>
						<Icon
							type="format_list_bulleted"
							:size="16"
						/>
						列表与整理
					</button>
				</div>
			</div>
			<div class="browser-search-row">
				<FileBreadcrumb
					v-if="currentFolder.type !== 'root'"
					:key="currentFolder.uid"
				/><FileFilters /><a-button
					v-if="currentSearchedEntities"
					size="small"
					@click="resetSearch"
					>重置筛选</a-button
				>
			</div>
			<FileMultipleOperators />
		</section>
		<EnvironmentAlert class="mb-3" />
		<div
			v-if="!displayEntities.length"
			class="polished-empty"
		>
			<span class="empty-symbol"
				><Icon
					type="travel_explore"
					:size="46"
			/></span>
			<h3>
				{{
					filter === 'running'
						? '还没有运行中的空间'
						: currentSearchedEntities
						? '没有找到匹配的空间'
						: '新的学习，从这里出发。'
				}}
			</h3>
			<p>
				{{
					filter === 'running'
						? '打开一个课程空间，运行状态会出现在这里。'
						: '建立独立的浏览器环境，保存课程账号，搭配脚本与 AI 助手。'
				}}
			</p>
			<button
				v-if="!currentSearchedEntities && filter === 'all'"
				class="dew-button"
				@click="newBrowserOrInit()"
			>
				创建第一个空间 ↗
			</button>
		</div>
		<Transition
			v-if="displayEntities.length"
			name="content-reveal"
			mode="out-in"
			><div
				v-if="view === 'cards'"
				key="cards"
				class="space-grid"
			>
				<template
					v-for="entity in displayEntities"
					:key="entity.uid"
					><BrowserSpaceCard
						v-if="entity.type === 'browser'"
						:browser="entity" />
					<article
						v-else
						class="folder-tile"
					>
						<a-input
							v-if="entity.renaming"
							:default-value="entity.name"
							aria-label="文件夹名称"
							@blur="(event: FocusEvent) => entity.rename((event.target as HTMLInputElement).value.trim() || entity.name)"
							@press-enter="(event: KeyboardEvent) => entity.rename((event.target as HTMLInputElement).value.trim() || entity.name)"
						/>
						<button
							v-else
							@click="entity.select()"
						>
							<Icon
								type="folder_open"
								:size="28"
							/><span>{{ entity.name }}</span></button
						><EntityOperator :entity="entity" /></article
				></template>
			</div>
			<div
				v-else
				key="list"
				class="browser-list-surface dew-card"
			>
				<BrowserList :entities="displayEntities" /><RightClickOpenMenuTip /></div
		></Transition>
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import PageIntro from '../../components/PageIntro.vue';
import Icon from '../../components/Icon.vue';
import { resetSearch } from '../../utils/entity';
import { newBrowserOrInit } from '../../utils/browser';
import FileFilters from '../../components/browsers/FileFilters.vue';
import FileBreadcrumb from '../../components/browsers/FileBreadcrumb.vue';
import { currentEntities, currentSearchedEntities, currentFolder } from '../../fs';
import { root } from '../../fs/folder';
import FileMultipleOperators from '../../components/browsers/FileMultipleOperators.vue';
import BrowserList from '../../components/BrowserList.vue';
import BrowserSpaceCard from '../../components/browsers/BrowserSpaceCard.vue';
import EntityOperator from '../../components/EntityOperator.vue';
import NotificationBanner from '../../components/NotificationBanner.vue';
import { store } from '../../store';
import RightClickOpenMenuTip from '../../components/RightClickOpenMenuTip.vue';
import EnvironmentAlert from '../../components/EnvironmentAlert.vue';
import { Process } from '../../utils/process';
import { embeddedBrowsers } from '../../composables/useEmbeddedBrowsers';
const view = ref<'cards' | 'list'>('cards');
const filter = ref<'all' | 'running'>('all');
const isRunning = (uid: string) => embeddedBrowsers.includes(uid) || Process.from(uid)?.status === 'launched';
const allBrowsers = computed(() => root().findAll((e) => e.type === 'browser'));
const runningCount = computed(() => allBrowsers.value.filter((e) => isRunning(e.uid)).length);
const displayEntities = computed(() =>
	(currentSearchedEntities.value ?? currentEntities.value).filter(
		(e) => filter.value === 'all' || (e.type === 'browser' && isRunning(e.uid))
	)
);
const stats = computed(() => ({
	browsers: allBrowsers.value.length,
	folders: root().findAll((e) => e.type === 'folder').length,
	scripts: store.render.scripts.length
}));
</script>
<style scoped>
.browser-controls {
	margin-bottom: 18px;
}
.browser-search-row {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
	margin-bottom: 8px;
}
.browser-list-surface {
	margin-top: 20px;
}
.browser-controls :deep(.arco-row) {
	margin: 0;
}
.browsers-page {
	min-height: 100%;
}
</style>
