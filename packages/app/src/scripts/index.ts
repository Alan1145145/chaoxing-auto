import { CXPhoneLoginScript, CXUnitLoginScript } from './automation/wk/cx';
import { ZHSPhoneLoginScript, ZHSUnitLoginScript } from './automation/wk/zhs';
import { ICVELoginScript } from './automation/wk/icve';
import { ZJYLoginScript } from './automation/wk/zjy';
import { XuexiOpenScript } from './automation/wk/xuexi';
import { NewPageScript } from './automation/common';

export const AutomationScripts = [
	CXPhoneLoginScript,
	CXUnitLoginScript,
	ZHSPhoneLoginScript,
	ZHSUnitLoginScript,
	ZJYLoginScript,
	ICVELoginScript,
	XuexiOpenScript,
	NewPageScript
];
