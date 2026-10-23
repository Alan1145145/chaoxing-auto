<template>
	<div class="settings-layout">
		<aside
			class="settings-nav"
			aria-label="设置分类"
		>
			<div class="settings-nav-title">YOUR PREFERENCES</div>
			<button
				v-for="section in sections"
				:key="section.id"
				:class="{ active: activeSection === section.id }"
				:aria-pressed="activeSection === section.id"
				@click="activeSection = section.id"
			>
				<Icon
					:type="section.icon"
					:size="20"
				/>{{ section.title }}
			</button>
			<div class="settings-nav-footnote">一点调整，让学习更顺手。<br />偏好修改后会自动保存在本机。</div>
		</aside>
		<div class="settings-content">
			<Transition
				name="content-reveal"
				mode="out-in"
				><div :key="activeSection">
					<a-card
						v-if="activeSection === 'general'"
						title="常规偏好"
						><p class="settings-section-summary">让工作空间适应你的习惯。选择喜欢的外观与窗口行为。</p>
						<Description label="开机自动启动"
							><a-switch
								v-model="store.window.autoLaunch"
								aria-label="开机自动启动" /></Description
						><Description label="窗口始终置顶"
							><a-switch
								v-model="store.window.alwaysOnTop"
								aria-label="窗口始终置顶" /></Description
						><Description label="深色外观"
							><a-switch
								v-model="store.render.setting.theme.dark"
								aria-label="深色外观"
								@click="changeTheme" /></Description
						><Description label="显示导航文字"
							><a-switch
								v-model="store.render.setting.showSideBarText"
								aria-label="显示导航文字" /></Description
					></a-card>
					<template v-if="activeSection === 'browser'"
						><a-card title="浏览器与运行"
							><p class="settings-section-summary">配置课程运行环境。独立账号、脚本与缓存会随学习空间保存。</p>
							<BrowserPath /><Description label="保留网页原生弹窗"
								><a-tooltip content="网页原生弹窗可能中断自动运行"
									><a-switch
										v-model="store.render.setting.browser.enableDialog"
										aria-label="保留网页原生弹窗" /></a-tooltip></Description
							><Description label="每次强制安装脚本"
								><a-tooltip content="启动时跳过版本检查，重新安装启用的脚本"
									><a-switch
										v-model="store.render.setting.browser.forceUpdateScript"
										aria-label="每次强制安装脚本" /></a-tooltip></Description
							><Description label="新空间自动初始化"
								><a-switch
									v-model="store.render.setting.browser.autoInitNewBrowser"
									aria-label="新空间自动初始化" /></Description></a-card
						><a-card title="缓存提醒"
							><p class="settings-section-summary">当浏览器缓存超过阈值时，提醒你整理本地空间。</p>
							<Description label="提醒阈值"
								><a-input-number
									v-model="store.render.setting.browser.cachesSizeWarningPoint"
									style="width: 180px"
									><template #append>GB</template></a-input-number
								></Description
							></a-card
						></template
					>
					<a-card
						v-if="activeSection === 'scripts'"
						title="课程脚本"
						><p class="settings-section-summary">统一设置课程脚本的行为、题库与答题偏好，再同步到各个浏览器。</p>
						<div class="script-settings-launch">
							<span class="space-emblem"
								><Icon
									type="code"
									:size="28"
							/></span>
							<div>
								<h3>OCS 课程配置</h3>
								<p>{{ store.render.setting.ocs.openSync ? '已开启全局同步' : '配置后可同步到课程空间' }}</p>
							</div>
							<button
								class="dew-button"
								@click="state.show = true"
							>
								打开配置 ↗
							</button>
						</div></a-card
					>
					<template v-if="activeSection === 'storage'"
						><a-card title="本地存储路径"
							><p class="settings-section-summary">
								学习空间与下载资源都保存在你的电脑。修改缓存路径时会处理已有浏览器缓存。
							</p>
							<Path
								label="浏览器缓存"
								name="userDataDirsFolder"
								:setting="true"
								@on-path-change="onUserDataDirsFolderChange" /><Path
								label="下载资源"
								name="downloadFolder" /><Path
								label="软件数据"
								name="user-data-path" /><Path
								label="应用程序"
								name="exe-path"
						/></a-card>
						<div class="settings-danger">
							<div>
								<span>重置软件设置</span>
								<p>恢复初始设置并重新启动，请在确认后执行。</p>
							</div>
							<a-popconfirm
								content="确认重置设置并重新启动软件吗？"
								ok-text="确认重置"
								@ok="reset"
								><a-button status="danger">重置设置</a-button></a-popconfirm
							>
						</div></template
					>
				</div></Transition
			>
		</div>
		<a-modal
			v-model:visible="state.show"
			title="课程脚本配置"
			:width="760"
			:mask-closable="false"
			:footer="state.configs.error === '' && state.configs.loading === false"
			ok-text="保存并同步到各浏览器"
			cancel-text="取消同步"
			@cancel="syncNote"
			@ok="store.render.setting.ocs.openSync = true"
			><div
				v-if="state.show"
				id="ocs-global-configs"
			>
				<OCSConfigs
					v-model:store="store.render.setting.ocs.store"
					@error="(err) => (state.configs.error = err)"
					@loading="state.configs.loading = true"
					@loaded="state.configs.loading = false"
				/></div
		></a-modal>
	</div>
</template>
<script setup lang="ts">
import Description from './Description.vue';
import Path from './Path.vue';
import { lang, store } from '../store';
import { remote } from '../utils/remote';
import BrowserPath from './setting/BrowserPath.vue';
import OCSConfigs from './OCSConfigs.vue';
import { reactive, ref } from 'vue';
import { changeTheme } from '../utils';
import Icon from './Icon.vue';
import { forceClearBrowserCache } from '../utils/browser';
import { Message } from '@arco-design/web-vue';
import { Folder } from '../fs/folder';
import { Browser } from '../fs/browser';

interface SettingPanelProps {
	simple?: boolean;
}

withDefaults(defineProps<SettingPanelProps>(), {
	simple: false
});

const activeSection = ref('general');
const sections = [
	{ id: 'general', icon: 'tune', title: '常规偏好' },
	{ id: 'browser', icon: 'language', title: '浏览器与运行' },
	{ id: 'scripts', icon: 'code', title: '课程脚本' },
	{ id: 'storage', icon: 'storage', title: '存储与路径' }
];
const state = reactive({
	show: false,
	configs: {
		error: '',
		loading: true
	}
});

/** 重置设置 */
async function reset() {
	// @ts-ignore
	store.version = undefined;
	remote.app.call('relaunch');
	remote.app.call('exit', 0);
}
async function onUserDataDirsFolderChange(previous: string, current: string) {
	// 更改全部浏览器缓存路径
	const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser') as Browser[];
	if (browsers.length > 0) {
		for (const browser of browsers) {
			browser.cachePath = await remote.path.call('join', current, browser.uid);
		}
	}

	await forceClearBrowserCache('检测到浏览器缓存路径，正在清空之前的缓存数据...', previous);
}

function syncNote() {
	store.render.setting.ocs.openSync = false;
	Message.info({
		content: lang('setting_browser_ocs_config_sync_tip_v2', '修改全局设置后并且同步到各浏览器才会生效哦~'),
		duration: 10 * 1000
	});
}
</script>
<style scoped>
#ocs-global-configs {
	overflow: auto;
	max-height: 65vh;
}
.script-settings-launch {
	display: flex;
	align-items: center;
	gap: 18px;
	padding: 24px 0;
}
.script-settings-launch h3 {
	font-size: 16px;
	margin: 0 0 8px;
	font-weight: 500;
}
.script-settings-launch p {
	font-size: 11px;
	color: var(--dew-muted);
	margin: 0;
}
.script-settings-launch .dew-button {
	margin-left: auto;
}
</style>
