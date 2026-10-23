<template>
	<div class="dew-page resources-page">
		<PageIntro
			eyebrow="TOOLS FOR YOUR FLOW"
			title="顺手的工具，就在这里。"
			description="精选运行资源，为你的学习空间补齐每一块拼图。"
			><button
				class="dew-button secondary"
				:disabled="inBrowser"
				@click="openDownloadFolder"
			>
				<Icon
					type="folder_open"
					:size="16"
				/>资源文件夹
			</button></PageIntro
		>
		<div class="resource-intro dew-card">
			<span class="resource-intro-icon">✳</span>
			<div>
				<h3>给学习，多一点可能。</h3>
				<p>选择脚本管理器和扩展。安装后，可在学习空间中使用。</p>
			</div>
			<button
				class="dew-link"
				@click="state.modal.other_extensions_add = true"
			>
				如何添加其他扩展 ↗
			</button>
		</div>
		<div
			v-if="resourceGroups.length"
			class="view-switch resource-categories"
			aria-label="资源分类"
		>
			<button
				:class="{ active: selectedGroup === 'all' }"
				@click="selectedGroup = 'all'"
			>
				全部资源</button
			><button
				v-for="group in resourceGroups"
				:key="group.name"
				:class="{ active: selectedGroup === group.name }"
				@click="selectedGroup = group.name"
			>
				{{ group.description }}
			</button>
		</div>
		<div
			v-if="state.loading"
			class="resource-grid"
			aria-label="正在加载资源"
		>
			<div
				v-for="i in 3"
				:key="i"
				class="resource-skeleton"
			>
				<div />
				<div />
				<div />
			</div>
		</div>
		<div
			v-else-if="loadError || !resourceGroups.length"
			class="polished-empty"
		>
			<span class="empty-symbol"
				><Icon
					type="widgets"
					:size="42"
			/></span>
			<h3>{{ loadError ? '工具箱，稍后再见。' : '资源列表还在等待填充。' }}</h3>
			<p>{{ loadError || '暂时没有可用资源，请稍后重新加载。' }}</p>
			<button
				v-if="!inBrowser"
				class="dew-button secondary"
				@click="loadResources"
			>
				重新加载 ↻
			</button>
		</div>
		<section
			v-for="group in visibleGroups"
			v-else
			:key="group.name"
		>
			<h2 class="resource-group-label">
				{{ group.description }}<span>{{ group.files.length }} 项</span>
			</h2>
			<div class="resource-grid">
				<article
					v-for="file in group.files"
					:key="file.url"
					class="resource-tile"
				>
					<div class="resource-tile-head">
						<span class="resource-logo"
							><img
								v-if="file.icon"
								:src="file.icon"
								alt=""
								loading="lazy" /><Icon
								v-else
								type="extension"
								:size="24"
						/></span>
						<h3>
							<a
								v-if="file.homepage"
								:href="file.homepage"
								target="_blank"
								rel="noreferrer"
								>{{ file.name }} ↗</a
							><span v-else>{{ file.name }}</span>
						</h3>
					</div>
					<p>{{ file.description || '为浏览器添加更多能力，配合课程与脚本使用。' }}</p>
					<div
						v-if="fileStatus[file.url]"
						class="resource-tile-footer"
					>
						<span>{{
							fileStatus[file.url].exists ? '已安装到本机' : fileStatus[file.url].downloading ? '正在下载…' : '可安装'
						}}</span
						><a-button
							v-if="fileStatus[file.url].exists || fileStatus[file.url].downloadRate === 100"
							size="small"
							@click="remove(group.name, file)"
							>卸载</a-button
						><a-progress
							v-else-if="fileStatus[file.url].downloadRate > 0"
							style="width: 120px"
							:percent="Math.min(1, fileStatus[file.url].downloadRate / 100)"
							size="small"
						/><span v-else-if="fileStatus[file.url].unzipping">正在解压…</span
						><a-button
							v-else
							type="primary"
							size="small"
							:disabled="
								fileStatus[file.url].downloading ||
								(group.name === 'extensions' && downloadingExtensionsFiles.length !== 0)
							"
							@click="download(group.name, file)"
							>安装 ↗</a-button
						>
					</div>
				</article>
			</div>
		</section>
		<a-modal
			v-model:visible="state.modal.other_extensions_add"
			title="添加其他扩展"
			:footer="false"
			><div class="extension-help">
				<span class="space-emblem"
					><Icon
						type="extension"
						:size="28"
				/></span>
				<h3>让工具融入你的学习方式。</h3>
				<p>在资源文件夹中管理扩展，并按浏览器支持的方式加载。</p>
				<div v-html="lang('notice_resources_page_other_extensions_add', '')" /></div
		></a-modal>
	</div>
</template>
<script setup lang="ts">
import PageIntro from '../../components/PageIntro.vue';
import { ref, reactive, onActivated, computed } from 'vue';
import { ResourceFile, ResourceGroup } from '@ocs-desktop/common/src/api';
import { resourceLoader } from '../../utils/resources.loader';
import Icon from '../../components/Icon.vue';
import { lang, store } from '../../store/index';
import { Message } from '@arco-design/web-vue';
import { child_process, electron, inBrowser } from '../../utils/node';
import { remote } from '../../utils/remote';
import { getRemoteInfos } from '../../utils';
import { Status } from '../../utils/statusBar';

const { ipcRenderer } = electron;

type FileState = Record<string, { exists: boolean; downloading: boolean; unzipping: boolean; downloadRate: number }>;

const resourceGroups = ref<ResourceGroup[]>([]);
const fileStatus = reactive<FileState>({});

// 正在下载的脚本管理器文件
const downloadingExtensionsFiles = ref<ResourceFile[]>([]);

const state = reactive({
	loading: true,
	modal: {
		other_extensions_add: false
	}
});

const selectedGroup = ref('all');
const loadError = ref('');
const visibleGroups = computed(() =>
	resourceGroups.value.filter((group) => selectedGroup.value === 'all' || group.name === selectedGroup.value)
);
onActivated(loadResources);
function loadResources() {
	if (inBrowser) {
		state.loading = false;
		loadError.value = '请在桌面应用中加载、安装与管理资源。';
		return;
	}
	loadError.value = '';
	state.loading = true;
	Status.loading('加载资源中...');
	getRemoteInfos()
		.then(async (result) => {
			resourceGroups.value = result.resourceGroups.filter((g) => g.showInResourcePage);

			// 加载状态
			for (const group of result.resourceGroups) {
				for (const file of group.files) {
					fileStatus[file.url] = {
						exists: resourceLoader.isZipFile(file)
							? await resourceLoader.isZipFileExists(group.name, file)
							: await resourceLoader.isExists(group.name, file),
						downloading: false,
						unzipping: false,
						downloadRate: 0
					};
				}
			}
			Status.success('资源加载成功');
		})
		.catch((err) => {
			// @ts-ignore
			loadError.value = '资源暂时无法加载，请检查网络后重试。';
		})
		.finally(() => {
			state.loading = false;
			Status.clear();
		});
}

async function download(group_name: string, file: ResourceFile) {
	// 如果group分组是 extensions 只能安装一个
	if (group_name === 'extensions') {
		const group = resourceGroups.value.filter((g) => g.name === 'extensions');
		if (group[0].files.some((f) => fileStatus[f.url].exists)) {
			Message.warning('脚本管理器只能安装一个。如需切换请把另外的删除后再安装。');
			return;
		}

		downloadingExtensionsFiles.value.push(file);
	}

	try {
		const files = await resourceLoader.list();

		for (const localFile of files) {
			// 如果存在前缀同名的文件，但是删除后不为空，说明是不同版本的文件，需要删除（历史遗留问题，之前的文件并没有id区分）
			if (localFile.filename.startsWith(file.id) && localFile.filename.replace(file.id, '').trim() !== '') {
				await remote.fs.call('rmSync', localFile.path, {
					recursive: true
				});
			}
		}

		const listener = (e: any, channel: string, rate: number) => {
			fileStatus[file.url].downloadRate = rate;
		};

		// 监听下载进度
		ipcRenderer.on('download', listener);
		try {
			fileStatus[file.url].downloading = true;
			await resourceLoader.download(group_name, file);
			fileStatus[file.url].downloading = false;
			fileStatus[file.url].downloadRate = 0;

			if (resourceLoader.isZipFile(file)) {
				fileStatus[file.url].unzipping = true;
				Message.info(`正在解压：${file.name}`);
				await resourceLoader.unzip(group_name, file);
				fileStatus[file.url].unzipping = false;
			}

			fileStatus[file.url].exists = true;
			Message.success(`${file.name} 下载完成`);
		} catch (err) {
			// @ts-ignore
			Message.error('下载错误 ' + err.message);
		} finally {
			fileStatus[file.url].downloading = false;
			fileStatus[file.url].unzipping = false;
			fileStatus[file.url].downloadRate = 0;
			ipcRenderer.removeListener('download', listener);
		}
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	}

	downloadingExtensionsFiles.value = downloadingExtensionsFiles.value.filter((f) => f.url !== file.url);
}

async function remove(group_name: string, file: ResourceFile) {
	try {
		await resourceLoader.remove(group_name, file);
		fileStatus[file.url].exists = false;
	} catch (err) {
		// @ts-ignore
		Message.error('删除错误 ' + err.message);
	}
}

function openDownloadFolder() {
	if (process.platform === 'win32') {
		// 如果使用下面那个方法的话不会出现在最前面
		child_process.exec(`explorer.exe "${store.paths.downloadFolder}"`);
	} else {
		electron.shell.openPath(store.paths.downloadFolder);
	}
}
</script>
<style scoped>
.resource-intro {
	display: flex;
	align-items: center;
	gap: 20px;
	background: linear-gradient(120deg, var(--dew-surface), var(--dew-yellow));
	margin-bottom: 24px;
}
.resource-intro-icon {
	font-size: 48px;
	color: var(--dew-olive);
}
.resource-intro h3 {
	font-size: 20px;
	font-weight: 450;
	margin: 0 0 7px;
}
.resource-intro p {
	font-size: 11px;
	color: var(--dew-muted);
	margin: 0;
}
.resource-intro .dew-link {
	margin-left: auto;
}
.resource-categories {
	display: inline-flex;
}
.resource-skeleton {
	background: var(--dew-surface);
	padding: 24px;
	border-radius: 20px;
}
.resource-skeleton > div {
	height: 14px;
	width: 70%;
	margin-bottom: 18px;
	border-radius: 8px;
	background: linear-gradient(90deg, var(--dew-bg), var(--dew-border), var(--dew-bg));
	background-size: 200% 100%;
	animation: skeleton-flow 1.4s ease infinite;
}
.resource-skeleton > div:first-child {
	width: 44px;
	height: 44px;
}
.resource-skeleton > div:last-child {
	width: 45%;
}
.extension-help p {
	color: var(--dew-muted);
	font-size: 12px;
	line-height: 1.9;
}
@keyframes skeleton-flow {
	to {
		background-position: -200% 0;
	}
}
@media (max-width: 750px) {
	.resource-intro {
		flex-wrap: wrap;
	}
	.resource-intro .dew-link {
		margin-left: 0;
	}
}
</style>
