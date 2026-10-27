import { createOcsQuestionBankAnswererWrapper } from '@ocsjs/scripts';
import { store } from '../store';
import { remote } from './remote';

/** Wire the local answerer into the same OCS config used by embedded course tabs. */
export async function connectQuestionBank() {
	const current = store.render.setting.ocs.store as Record<string, any>;
	if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('OCS 配置格式无效。');
	const names = new Set(['OCS 内置题库', 'ZError API题库']);
	const wrappers = (
		Array.isArray(current['common.settings.answererWrappers']) ? current['common.settings.answererWrappers'] : []
	).filter((item: any) => !names.has(item?.name));
	wrappers.unshift(createOcsQuestionBankAnswererWrapper(`http://localhost:${Number(store.server.port) || 15319}`));
	if (wrappers.length > 10) throw new Error('题库配置超过 10 个，请在模型接入页面整理配置。');
	const previousOpenSync = store.render.setting.ocs.openSync;
	store.render.setting.ocs.store = {
		...current,
		'common.settings.answererWrappers': wrappers,
		'common.settings.disabledAnswererWrapperNames': (Array.isArray(
			current['common.settings.disabledAnswererWrapperNames']
		)
			? current['common.settings.disabledAnswererWrapperNames']
			: []
		).filter((name: string) => !names.has(name))
	};
	store.render.setting.ocs.openSync = true;
	try {
		await remote.methods.call('saveStore', JSON.stringify(store), remote.methods.callSync('isEncryptionAvailable'));
	} catch (error) {
		store.render.setting.ocs.store = current;
		store.render.setting.ocs.openSync = previousOpenSync;
		throw error;
	}
}
