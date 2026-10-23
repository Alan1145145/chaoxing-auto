<template>
	<div class="dew-page library-page">
		<header class="dew-heading">
			<div>
				<div class="dew-eyebrow">YOUR PERSONAL KNOWLEDGE</div>
				<h1>把理解，留在这里。</h1>
				<p>管理本地题库，复习、核对并积累属于你的知识。</p>
			</div>
			<button
				class="dew-button"
				@click="edit()"
			>
				<Icon type="add" />添加题目
			</button>
		</header>
		<section class="dew-card">
			<div class="library-toolbar">
				<a-input-search
					v-model="query"
					placeholder="搜索题目、选项或答案"
					style="max-width: 340px"
					@search="search"
					@press-enter="search"
				/>
				<div>
					<input
						ref="fileInput"
						type="file"
						accept=".json"
						hidden
						@change="importFile"
					/><a-button
						:loading="importing"
						@click="fileInput?.click()"
						>导入 JSON</a-button
					><a-button @click="exportFile">导出题库</a-button>
				</div>
			</div>
			<a-alert
				v-if="error"
				type="warning"
				:show-icon="false"
				class="mb-3"
				>{{ error }}</a-alert
			>
			<a-table
				:data="items"
				:loading="loading"
				:pagination="false"
				:bordered="false"
				row-key="id"
			>
				<template #columns
					><a-table-column
						title="题目"
						:width="340"
						><template #cell="{ record }"
							><div class="question-title">{{ record.title }}</div>
							<span class="question-type">{{ record.type || '未分类' }}</span></template
						></a-table-column
					><a-table-column title="答案"
						><template #cell="{ record }"
							><div class="answer-preview">{{ record.answer }}</div></template
						></a-table-column
					><a-table-column
						title="状态"
						:width="115"
						><template #cell="{ record }"
							><span
								class="dew-pill"
								:class="{ ready: record.verified }"
								>{{ record.verified ? '已核对' : '待核对' }}</span
							></template
						></a-table-column
					><a-table-column
						title="来源"
						:width="80"
						><template #cell="{ record }">{{
							record.source === 'ai' ? 'AI' : record.source === 'import' ? '导入' : '手动'
						}}</template></a-table-column
					><a-table-column
						title="操作"
						:width="120"
						><template #cell="{ record }"
							><a-button
								type="text"
								size="mini"
								@click="edit(record)"
								>编辑</a-button
							><a-popconfirm
								content="确定删除这道题目？"
								@ok="remove(record.id)"
								><a-button
									type="text"
									size="mini"
									status="danger"
									>删除</a-button
								></a-popconfirm
							></template
						></a-table-column
					></template
				>
				<template #empty
					><div class="library-empty">
						<span>✳</span>
						<h3>每道好题，都值得留下。</h3>
						<p>添加题目、导入题库，或连接豆包积累 AI 答案。</p>
					</div></template
				>
			</a-table>
			<div class="library-pagination">
				<span>共 {{ total }} 道题 · 数据保存在本机</span
				><a-pagination
					:current="page"
					:page-size="20"
					:total="total"
					size="small"
					@change="changePage"
				/>
			</div>
		</section>
		<a-modal
			v-model:visible="editing"
			:title="form.id ? '编辑题目' : '添加题目'"
			:ok-loading="saving"
			:width="660"
			@before-ok="save"
			><a-form
				:model="form"
				layout="vertical"
				><a-form-item
					label="题目"
					required
					><a-textarea
						v-model="form.title"
						:auto-size="{ minRows: 2, maxRows: 6 }" /></a-form-item
				><a-form-item label="题型"
					><a-input
						v-model="form.type"
						placeholder="如：单选、多选、判断、填空" /></a-form-item
				><a-form-item label="选项"
					><a-textarea
						v-model="form.options"
						placeholder="每行一个选项" /></a-form-item
				><a-form-item
					label="答案"
					required
					><a-textarea
						v-model="form.answer"
						placeholder="多个答案使用 ### 分隔" /></a-form-item
				><a-form-item label="解释"><a-textarea v-model="form.explanation" /></a-form-item
				><a-checkbox v-model="form.verified">我已核对这道题的答案</a-checkbox></a-form
			></a-modal
		>
	</div>
</template>
<script setup lang="ts">
import { onActivated, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { QuestionBankQuestion } from '@ocs-desktop/app';
import { remote } from '@/utils/remote';
import { inBrowser } from '@/utils/node';
import Icon from '@/components/Icon.vue';
const query = ref(''),
	error = ref(''),
	items = ref<QuestionBankQuestion[]>([]),
	total = ref(0),
	page = ref(1);
const loading = ref(false),
	editing = ref(false),
	saving = ref(false),
	importing = ref(false);
const fileInput = ref<HTMLInputElement>();
const empty = () => ({
	id: '',
	title: '',
	type: '',
	options: '',
	answer: '',
	explanation: '',
	verified: false,
	source: 'manual' as QuestionBankQuestion['source']
});
const form = reactive(empty());
async function load() {
	if (inBrowser) {
		error.value = '请在桌面端管理本地题库。';
		return;
	}
	loading.value = true;
	try {
		const result = await remote.methods.call('listQuestionBankQuestions', {
			query: query.value,
			page: page.value,
			pageSize: 20
		});
		items.value = result.items;
		total.value = result.total;
		error.value = '';
	} catch (e) {
		error.value = String(e);
	} finally {
		loading.value = false;
	}
}
function search() {
	page.value = 1;
	void load();
}
function changePage(value: number) {
	page.value = value;
	void load();
}
function edit(item?: QuestionBankQuestion) {
	Object.assign(form, empty(), item || {});
	editing.value = true;
}
async function save() {
	saving.value = true;
	try {
		await remote.methods.call('saveQuestionBankQuestion', { ...form });
		await load();
		Message.success('题目已保存。');
		return true;
	} catch (e) {
		Message.error(String(e));
		return false;
	} finally {
		saving.value = false;
	}
}
async function remove(id: string) {
	try {
		await remote.methods.call('deleteQuestionBankQuestion', id);
		if (items.value.length === 1 && page.value > 1) page.value--;
		await load();
	} catch (e) {
		error.value = String(e);
	}
}
async function importFile(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	importing.value = true;
	try {
		if (file.size > 10 * 1024 * 1024) throw new Error('题库文件不能超过 10MB。');
		const data = JSON.parse(await file.text());
		const result = await remote.methods.call('importQuestionBankQuestions', data);
		Message.success(`新增 ${result.added} 题，更新 ${result.updated} 题，跳过 ${result.skipped} 题。`);
		await load();
	} catch (e) {
		error.value = String(e);
	} finally {
		importing.value = false;
		input.value = '';
	}
}
async function exportFile() {
	try {
		const data = await remote.methods.call('exportQuestionBankQuestions');
		const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `chaoxing-question-bank-${new Date().toISOString().slice(0, 10)}.json`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	} catch (e) {
		error.value = String(e);
	}
}
onActivated(load);
</script>
<style scoped src="./style.css"></style>
