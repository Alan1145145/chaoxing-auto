<template>
	<div class="dew-page doubao-page">
		<header class="dew-heading">
			<div>
				<div class="dew-eyebrow">A LITTLE HELP, A LITTLE CLARITY</div>
				<h1>豆包，你的学习搭子。</h1>
				<p>问一个问题，把思路慢慢理清。</p>
			</div>
			<span
				class="dew-pill"
				:class="{ ready: status.loggedIn }"
				>{{ status.loggedIn ? '账号已连接' : '等待连接' }}</span
			>
		</header>
		<div
			v-if="error"
			class="doubao-error"
			role="alert"
		>
			{{ error
			}}<button
				class="dew-link"
				@click="refresh"
			>
				重新检查
			</button>
		</div>
		<div class="doubao-layout">
			<section class="chat-panel dew-card">
				<div class="chat-toolbar">
					<span><span class="bean-icon">✳</span>豆包助手 <small>DOUBAO</small></span
					><button
						class="dew-link"
						:disabled="sending"
						@click="newConversation"
					>
						＋ 新对话
					</button>
				</div>
				<div
					ref="messageArea"
					class="chat-messages"
					role="log"
					aria-live="polite"
					aria-label="对话记录"
				>
					<div
						v-if="!messages.length"
						class="chat-welcome"
					>
						<div class="welcome-orb">✳</div>
						<div class="dew-eyebrow">MAKE ROOM FOR CURIOSITY</div>
						<h2>今天，有什么想弄明白的？</h2>
						<p>一道题、一个概念，或是一段新知识。<br />从你的第一个问题开始。</p>
						<div class="prompt-chips">
							<button
								v-for="prompt in suggestions"
								:key="prompt"
								@click="draft = prompt"
							>
								{{ prompt }} ↗
							</button>
						</div>
					</div>
					<div
						v-for="(message, index) in messages"
						:key="index"
						class="chat-message"
						:class="message.role"
					>
						<span class="message-avatar">{{ message.role === 'user' ? '我' : '✳' }}</span>
						<div>
							<span class="message-name">{{ message.role === 'user' ? '你' : '豆包' }}</span>
							<div class="message-text">{{ message.content }}</div>
							<button
								v-if="message.role === 'assistant'"
								class="dew-link"
								@click="copy(message.content)"
							>
								复制回答
							</button>
						</div>
					</div>
					<div
						v-if="sending"
						class="thinking"
					>
						<span />豆包正在整理思路…
					</div>
				</div>
				<form
					class="chat-composer"
					@submit.prevent="send"
				>
					<textarea
						v-model="draft"
						:disabled="sending"
						maxlength="30000"
						rows="3"
						:placeholder="status.loggedIn ? '输入问题，或粘贴题目与选项…' : '先连接豆包账号，再开始你的第一次提问…'"
						aria-label="输入问题"
						@keydown.ctrl.enter.prevent="send"
					/>
					<div class="composer-bottom">
						<span>Ctrl + Enter 发送 · {{ modelLabel }}</span
						><button
							class="dew-button"
							type="submit"
							:disabled="sending || !draft.trim() || !status.loggedIn"
						>
							{{ sending ? '思考中…' : '发送' }}<span>↗</span>
						</button>
					</div>
				</form>
				<div class="chat-footnote">AI 回答可供学习参考，重要结论请自行核对。</div>
			</section>
			<aside class="doubao-aside">
				<section class="account-card dew-card">
					<div class="dew-card-title">豆包账号 <small>CONNECTION</small></div>
					<div class="account-emblem">✳</div>
					<h3>{{ status.loggedIn ? '已经连接，随时开聊。' : '连接一次，随时学习。' }}</h3>
					<p>扫码或使用官方网页登录。凭据由桌面端加密保存在本机。</p>
					<template v-if="!status.loggedIn"
						><button
							class="dew-button"
							:disabled="busy"
							@click="showQr"
						>
							{{ busy ? '准备中…' : '豆包 App 扫码登录' }}<Icon type="qr_code_2" /></button
						><button
							class="dew-button secondary"
							:disabled="busy"
							@click="webLogin"
						>
							手机号 / 官方网页登录 ↗</button
						><button
							class="dew-link cookie-link"
							@click="cookieVisible = true"
						>
							使用 Cookie 登录</button
						><span
							v-if="webWaiting"
							class="login-wait"
							>官方登录窗口已打开，登录后将自动同步…</span
						></template
					><template v-else
						><div class="account-connected"><i />凭据已保存 · 本地网关就绪</div>
						<button
							class="dew-link"
							:disabled="sending || busy"
							@click="logout"
						>
							退出豆包账号
						</button></template
					>
				</section>
				<section class="dew-card">
					<div class="dew-card-title">答题偏好 <small>MODEL</small></div>
					<label class="model-label">当前模型</label
					><a-select
						v-model="model"
						:options="modelOptions"
						:disabled="sending || saving"
					/>
					<p class="model-description">
						{{
							model === 'doubao-expert' || model === 'doubao-pro'
								? '更适合复杂问题与深入分析。'
								: '适合日常问答与知识解释。'
						}}
					</p>
					<button
						class="dew-button secondary"
						:disabled="!status.loggedIn || saving"
						@click="useForAnswers"
					>
						{{ saving ? '正在保存…' : '设为默认答题模型' }} ↗
					</button>
					<p class="answer-hint">保存后，课程自动答题将通过现有题库流程调用豆包。当前网关支持文本题目。</p>
				</section>
				<section class="gentle-note">
					<span>✳</span>
					<p>好的问题，<br />是理解的开始。</p>
					<small>STAY CURIOUS.</small>
				</section>
			</aside>
		</div>
		<a-modal
			v-model:visible="qrVisible"
			title="连接豆包 · 扫码登录"
			:footer="false"
			:width="400"
			@cancel="stopQr"
			><div class="qr-login">
				<div class="qr-frame">
					<a-spin v-if="qrLoading" /><img
						v-else-if="qrImage"
						:src="qrImage"
						alt="使用豆包 App 扫描此二维码登录"
					/><Icon
						v-else
						type="qr_code_2"
					/>
				</div>
				<p>{{ qrStatus }}</p>
				<small>打开豆包 App 扫一扫，并在手机端确认登录。</small
				><button
					class="dew-button secondary"
					:disabled="qrLoading"
					@click="createQr"
				>
					刷新二维码
				</button>
			</div></a-modal
		>
		<a-modal
			v-model:visible="cookieVisible"
			title="使用 Cookie 登录"
			:ok-loading="busy"
			@before-ok="saveCookie"
			><p class="cookie-help">
				粘贴你自己的豆包登录 Cookie。需要 sessionid 等完整会话字段；内容仅用于豆包登录与本地加密保存。
			</p>
			<a-textarea
				v-model="cookie"
				:auto-size="{ minRows: 5, maxRows: 10 }"
				placeholder="sessionid=…; sessionid_ss=…; …"
				aria-label="豆包 Cookie"
		/></a-modal>
	</div>
</template>
<script setup lang="ts">
import Icon from '../../components/Icon.vue';
import { useDoubao } from '../../composables/useDoubao';
const {
	status,
	error,
	busy,
	saving,
	sending,
	draft,
	model,
	messages,
	messageArea,
	suggestions,
	modelOptions,
	modelLabel,
	qrVisible,
	qrLoading,
	qrImage,
	qrStatus,
	cookieVisible,
	cookie,
	webWaiting,
	refresh,
	showQr,
	stopQr,
	createQr,
	webLogin,
	saveCookie,
	logout,
	useForAnswers,
	newConversation,
	send,
	copy
} = useDoubao();
</script>
<style scoped src="./style.css"></style>
