<template>
	<div class="dew-page about-page">
		<PageIntro
			eyebrow="ABOUT THIS APP"
			title="关于超星自动机"
			description="软件信息、修改说明、开源许可与致谢。"
		>
			<button
				class="dew-button secondary"
				@click="about"
			>
				<Icon type="menu_book" />使用教程
			</button>
		</PageIntro>

		<div class="about-grid">
			<section class="dew-card about-hero">
				<img
					class="about-logo"
					:src="'./ai-study-icon.svg'"
					alt="超星自动机"
				/>
				<div class="about-hero-text">
					<h2>超星自动机</h2>
					<p class="about-version">
						版本 {{ version || '—' }} <span class="dew-pill">基于 OCS Desktop 2.12.0 修改</span>
					</p>
					<dl class="about-meta">
						<div>
							<dt>作者</dt>
							<dd>alan34</dd>
						</div>
						<div>
							<dt>原作者</dt>
							<dd>enncy / ocsjs 团队</dd>
						</div>
						<div>
							<dt>开源许可</dt>
							<dd>MIT License（保留原作者版权声明）</dd>
						</div>
					</dl>
				</div>
			</section>

			<section class="dew-card">
				<div class="dew-card-title">软件简介 <small>INTRODUCTION</small></div>
				<p>
					超星自动机是一款面向超星学习通等网课平台的桌面学习辅助工具。它为每个账号建立独立的浏览器“学习空间”，
					配合内置的 OCS 网课助手课程脚本自动完成视频、文档、章节测试等任务点，并可接入豆包 AI
					或其他大模型进行辅助答题。
				</p>
				<p>
					本软件是作者 <b>alan34</b> 在原作者 <b>enncy</b>（ocsjs 团队）开源作品基础上修改而来的版本，
					不是原项目的官方发行版，请勿向原作者反馈本修改版的问题。
				</p>
			</section>

			<section class="dew-card">
				<div class="dew-card-title">原始开源项目 <small>ORIGINAL WORKS</small></div>
				<ul class="about-links">
					<li
						v-for="link in originalLinks"
						:key="link.url"
					>
						<span class="space-emblem"
							><Icon
								:type="link.icon"
								:size="22"
						/></span>
						<div>
							<strong>{{ link.name }}</strong>
							<p>{{ link.description }}</p>
							<a
								:href="link.url"
								@click.prevent="openLink(link.url)"
								>{{ link.url }} ↗</a
							>
						</div>
					</li>
				</ul>
			</section>

			<section class="dew-card">
				<div class="dew-card-title">本版本的主要修改 <small>WHAT'S CHANGED</small></div>
				<ul class="about-list">
					<li>
						<b>U校园 一键刷课：</b
						>侧边栏新增「U校园」页面：填写一次账号后，软件自动登录、进入「我的班课」、按关键词选择课程、打开学习页并让内置助手直接开始刷课；面板常驻、跳过用途二次确认，滑块验证只需人工完成一次。
					</li>
					<li>
						<b>U校园 403 自动恢复：</b>U校园 未登录时会直接对「我的班课」返回 403（页面只显示
						openresty），软件现在默认从登录入口进入；命中 403
						时自动转到登录，登录完成后再回到课程或学习页，不再停在错误页。
					</li>
					<li>
						<b>U校园 一键学习不再报「上下文已销毁」：</b>U校园 页面在跳转途中会销毁页面上下文，旧版会报 `Execution
						context was destroyed`
						并中断。现在所有页面操作都会在导航期间自动重试，并等页面地址与加载状态稳定后再继续，登录、选课、进入学习页全程不再被跳转打断。
					</li>
					<li>
						<b>U校园 助手自动接入软件端模型：</b>助手不再要求单独填 API
						Key，也不再让人在两边各选一次——文本 AI 直接跟随软件「模型接入」里选定的模型：选的是内置豆包且豆包已登录就走豆包直连，选了别的模型
						（DeepSeek / 自建 OpenAI 兼容等）就由软件用它转发。面板会显示当前跟随的模型，题目超过 3
						万字时自动改走「模型接入」链路，单题失败不会中断整轮刷课。
					</li>
					<li>
						<b>内置助手去二维码：</b
						>随包分发的「U校园刷课助手」已移除原始二维码、解锁码校验、作者远程公告与微信反馈条，AI 作答与 1.5
						秒题间节奏全部直接可用，不再依赖作者服务器。
					</li>
					<li>
						<b>U校园助手显示修复：</b
						>助手面板自动开始后保持展开（不再收回悬浮球），悬浮球上移并提升层级，避免被站点客服按钮遮挡；SPA
						重绘清掉节点时会自动挂回。
					</li>
					<li>
						<b>外部浏览器脚本自动安装：</b>启动课程空间时自动把 OCS 网课助手和 U校园刷课助手安装/更新到脚本猫。打开
						U校园 页面即可看到 OCS 悬浮面板与助手悬浮球；软件端「模型接入」在外部 Chrome 中同样可用（本机 127.0.0.1 回环）。
					</li>
					<li>
						<b>U校园 AI 作答复用软件端模型：</b
						>「U校园刷课助手」新增「超星自动机·跟随软件端」，文本题直接使用软件「模型接入」里配置的模型（默认内置豆包），无需另填
						Key；听力题仍可自备千问/智谱 Key。
					</li>
					<li>
						<b>词汇/朗读任务自动完成：</b>复刻 U校园
						官方的学习状态上报接口，Vocabulary/单词卡这类无题目任务可自动标记完成（不录音、不做语音评分），作业/测试不受影响。
					</li>
					<li>
						<b>U校园刷课助手（内置第三方脚本）：</b>随包内置 GPL-3.0 的「U校园刷课助手」（作者
						叶屿）：悬浮球面板、目录自动遍历、视频/音频自动播放与 AI
						自动作答；其网络请求走内置跨域桥，弹出面板不会被课程页重绘移除。详见「关于软件」页面与仓库 NOTICE。
					</li>
					<li>
						<b>U校园 接入：</b>新增 U校园 平台入口、登录自动化与 OCS 课程学习工程；打开 U校园 课程页时 OCS
						悬浮窗会自动出现，并修复了课程页早期启动脚本导致的反复登录与白屏问题。
					</li>
					<li>
						<b>豆包 AI 集成：</b>内置本地豆包网关（打包为独立程序，无需安装 Python），支持豆包 App
						扫码登录、官方网页（手机号）登录与 Cookie
						导入，凭据经加密只保存在本机；新增「豆包助手」对话页面，可一键设为默认答题模型，接入课程自动答题（目前支持文字题目）。
					</li>
					<li>
						<b>模型接入与本地题库：</b>「模型接入」页支持 OpenAI 兼容、Anthropic、Gemini
						接口；新增「本地题库」页面，支持查询、编辑、核对、删除以及 JSON 导入/导出。
					</li>
					<li>
						<b>内嵌浏览器：</b>课程可以直接在软件主窗口内打开，并运行本地构建的 OCSJS 5
						课程脚本；修复内嵌课程页滚动时外层界面被一起卷走的问题。
					</li>
					<li>
						<b>界面改造：</b
						>新增「学习概览」工作台，统一导航、页头、卡片与控件风格，加入页面切换动效并适配深色模式；设计新的软件图标与
						Windows 安装包。
					</li>
					<li><b>启动修复：</b>内置 Chrome 自动选择与解压流程优化、加密设置迁移修复、课程脚本配置加载修复。</li>
					<li>
						<b>本次更新：</b>软件更名为「超星自动机」；新增本「关于软件」页面；原项目的远程公告替换为本地「使用教程」。
					</li>
					<li>
						<b>软件更新：</b>只检查本项目 GitHub 的正式版本，发现更新后点击即可自动下载、校验、保存数据并安装重启；原项目的更新源保持停用。1.0.4 及更早版本需手动覆盖安装一次后才能使用应用内更新。
					</li>
					<li>
						<b>模型与豆包网关：</b>「模型接入」新增「接入千问」（阿里云百炼 OpenAI
						兼容接口）预设；豆包网关随包附带根证书并给出具体的出错原因，改善在其他电脑上扫码登录失败的问题。
					</li>
				</ul>
			</section>

			<section class="dew-card">
				<div class="dew-card-title">致谢 <small>THANKS</small></div>
				<p>
					衷心感谢原作者 <b>enncy</b> 及 <b>ocsjs 团队</b> 开源的 OCS Desktop 与 OCSJS
					网课助手。本软件的浏览器管理、脚本运行、自动化程序与课程脚本等核心能力均来自原项目，
					没有他们的开源与长期维护，就不会有这个修改版。
				</p>
				<p>
					同时感谢本软件所使用的 Electron、Vue、Arco Design、Playwright 等开源项目，以及豆包网关所参考的 Doubao2api
					项目。
				</p>
			</section>

			<section class="dew-card">
				<div class="dew-card-title">开源许可 <small>MIT LICENSE</small></div>
				<p>
					原项目 OCS Desktop 与 OCSJS 以 MIT
					许可证开源。按照许可证要求，本软件保留原作者的版权声明与许可声明，完整文本如下（安装目录
					<code>resources/app/LICENSE</code> 中也附带一份）：
				</p>
				<pre class="about-license">{{ licenseText }}</pre>
			</section>

			<section class="dew-card about-disclaimer">
				<div class="dew-card-title">免责声明 <small>DISCLAIMER</small></div>
				<ol>
					<li>本软件仅供个人学习与技术研究使用，禁止用于任何商业或违法用途。</li>
					<li>
						使用自动化工具可能违反学习平台或学校的相关规定，请自觉遵守平台规则；由使用本软件产生的一切后果（包括但不限于账号异常、成绩无效等）由使用者自行承担，作者与原作者不承担任何责任。
					</li>
					<li>本软件按“原样”提供，不提供任何形式的明示或暗示担保。AI 给出的答案仅供参考，请自行核对。</li>
					<li>账号密码、豆包登录凭据等信息仅加密保存在你的电脑上，请妥善保管，不要将导出的数据分享给他人。</li>
				</ol>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import PageIntro from '../../components/PageIntro.vue';
import Icon from '../../components/Icon.vue';
import { about } from '../../utils';
import { remote } from '../../utils/remote';
import { electron, inBrowser } from '../../utils/node';
import { ORIGINAL_LICENSE_TEXT } from '../../config/license';

const version = ref('');
const licenseText = ORIGINAL_LICENSE_TEXT;

const originalLinks = [
	{
		name: 'OCS Desktop',
		icon: 'desktop_windows',
		description: '原版桌面软件：浏览器多开、脚本管理与自动化程序（本软件基于其 2.12.0 版本修改）。',
		url: 'https://github.com/ocsjs/ocs-desktop'
	},
	{
		name: 'OCSJS 网课助手',
		icon: 'code',
		description: '原版网课课程脚本：超星学习通等平台的自动学习与答题。',
		url: 'https://github.com/ocsjs/ocsjs'
	}
];

/** 使用系统默认浏览器打开链接 */
function openLink(url: string) {
	if (!inBrowser && electron.shell?.openExternal) {
		void electron.shell.openExternal(url);
	} else {
		window.open(url, '_blank');
	}
}

onMounted(async () => {
	if (inBrowser) return;
	try {
		version.value = String(await remote.app.call('getVersion'));
	} catch (error) {
		console.error(error);
	}
});
</script>

<style scoped>
.about-page {
	max-width: 1100px;
}
.about-grid {
	display: grid;
	gap: 16px;
}
.about-grid p,
.about-grid li {
	font-size: 13px;
	line-height: 1.85;
	color: var(--color-text-2);
}
.about-grid p {
	margin: 0 0 10px;
}
.about-hero {
	display: flex;
	align-items: center;
	gap: 28px;
}
.about-logo {
	width: 96px;
	height: 96px;
	flex-shrink: 0;
}
.about-hero-text h2 {
	margin: 0;
	font-size: 26px;
	font-weight: 600;
	color: var(--dew-text);
}
.about-version {
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 6px 0 14px !important;
}
.about-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 12px 36px;
	margin: 0;
}
.about-meta dt {
	font-size: 10px;
	letter-spacing: 1px;
	color: var(--dew-muted);
	font-weight: 400;
}
.about-meta dd {
	margin: 2px 0 0;
	font-size: 14px;
	color: var(--dew-text);
}
.about-links {
	list-style: none;
	margin: 0;
	padding: 0;
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 16px;
}
.about-links li {
	display: flex;
	gap: 14px;
	padding: 16px;
	border-radius: 14px;
	background: var(--dew-bg);
}
.about-links .space-emblem {
	width: 44px;
	height: 44px;
	flex-shrink: 0;
	display: grid;
	place-items: center;
	border-radius: 15px;
	background: var(--dew-surface);
	color: var(--dew-olive);
}
.about-links strong {
	color: var(--dew-text);
	font-size: 14px;
}
.about-links p {
	margin: 4px 0 6px !important;
	font-size: 12px !important;
}
.about-links a {
	font-size: 12px;
	color: rgb(var(--primary-6));
	word-break: break-all;
	cursor: pointer;
}
.about-links a:hover {
	text-decoration: underline;
}
.about-list,
.about-disclaimer ol {
	margin: 0;
	padding-left: 20px;
}
.about-license {
	max-height: 260px;
	overflow: auto;
	margin: 0;
	padding: 14px 16px;
	border-radius: 12px;
	background: var(--dew-bg);
	color: var(--color-text-2);
	font-size: 11px;
	line-height: 1.6;
	white-space: pre-wrap;
}
@media (max-width: 720px) {
	.about-hero {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
