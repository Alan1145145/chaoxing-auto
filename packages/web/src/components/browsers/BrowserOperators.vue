<template>
	<a-space
		v-if="instance"
		:size="4"
		class="justify-content-end align-items-center browser-operators"
	>
		<template v-if="process === undefined || process.status === 'closed'">
			<a-tooltip
				:position="tooltipPosition"
				mini
			>
				<template #content>
					启动浏览器 <br />
					- 并自动安装脚本 <br />
					- 以及执行自动化程序等一系列操作。
				</template>

				<a-button
					size="mini"
					type="text"
					@click.stop="instance?.launchExternal()"
				>
					<Icon
						type="play_circle"
						color="#86909c"
						:class="iconClass"
					/>
					<span class="ms-1">外部启动</span>
				</a-button>
			</a-tooltip>
		</template>

		<template v-else-if="process.status === 'launched'">
			<a-tooltip
				content="置顶"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.bringToFront()"
				>
					<Icon
						type="push_pin"
						:class="iconClass"
						color="#165dff"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				content="重启"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.relaunch()"
				>
					<Icon
						type="sync"
						:class="iconClass"
						color="#165dff"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				content="关闭"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.close()"
				>
					<Icon
						type="cancel"
						:class="iconClass"
						color="#ff0000db"
					/>
				</a-button>
			</a-tooltip>
		</template>

		<!-- 加载中 -->
		<template v-else-if="process.status === 'launching' || process.status === 'closing'">
			<a-button
				type="text"
				size="mini"
				style="color: gray"
			>
				<icon-loading :class="iconClass" />
			</a-button>
		</template>

		<a-tooltip content="在软件主窗口内打开">
			<a-button
				size="mini"
				type="primary"
				@click.stop="instance?.openInApp()"
			>
				<Icon
					type="web"
					:class="iconClass"
					color="#165dff"
				/>
				<span class="ms-1">{{ embeddedBrowsers.includes(props.browser.uid) ? '切换到窗口' : '内嵌打开' }}</span>
			</a-button>
		</a-tooltip>
		<slot name="extra"></slot>
	</a-space>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue';
import { Process } from '../../utils/process';
import { computed } from 'vue';
import { Browser } from '../../fs/browser';
import { BrowserOptions } from '../../fs/interface';
import { embeddedBrowsers } from '../../composables/useEmbeddedBrowsers';

const props = withDefaults(
	defineProps<{
		browser: BrowserOptions;
		tooltipPosition?: 'top' | 'br';
		iconClass?: string;
	}>(),
	{
		tooltipPosition: 'top',
		iconClass: 'fs-6'
	}
);
const instance = Browser.from(props.browser.uid);
const process = computed(() => Process.from(props.browser.uid));
</script>

<style scoped lang="less">
.browser-operators {
	.arco-space-item {
		cursor: pointer;
	}
}
</style>
