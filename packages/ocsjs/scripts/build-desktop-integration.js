const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const ocsRoot = path.resolve(__dirname, '..');
const desktopRoot = path.resolve(ocsRoot, '../..');
const utilsRoot = path.join(ocsRoot, 'packages', 'utils');
const coreRoot = path.join(ocsRoot, 'packages', 'core');
const scriptsRoot = path.join(ocsRoot, 'packages', 'scripts');
const webPublicRoot = path.join(desktopRoot, 'packages', 'web', 'public', 'ocsjs');
const appPublicRoot = path.join(desktopRoot, 'packages', 'app', 'public', 'ocsjs');

function run(command, cwd, env = {}) {
	console.log(`[ocsjs] ${command} (${path.relative(desktopRoot, cwd)})`);
	execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function createBuildOptions(ocs, cssPath, outputPath) {
	const projectList = [ocs.CXProject, ocs.ZHSProject, ocs.ZJYProject, ocs.IcveMoocProject, ocs.ICourseProject, ocs.YKTProject]
		.map((project) => `【${project.name}】`)
		.join(' ');
	const match = Array.from(
		new Set(ocs.definedProjects().flatMap((project) => (project.domains || []).map((domain) => `*://*.${domain}/*`)))
	);

	return {
		parseRequire: true,
		parseResource: true,
		resourceBuilder: (key, value) => `const ${key} = ${JSON.stringify(value)};`,
		metaDataFormatter: {
			header: '==UserScript==',
			footer: '==/UserScript==',
			prefix: '// ',
			symbol: '@',
			gap: '\t'.repeat(4)
		},
		metadata: {
			name: 'OCS 网课助手',
			version,
			description: [
				'OCS(online-course-script) 网课助手，官网 https://docs.ocsjs.com，支持 ',
				projectList,
				'等网课平台。具体功能请查看脚本面板中的教程。'
			].join(' '),
			author: 'enncy',
			license: 'MIT',
			namespace: 'https://enncy.cn',
			homepage: 'https://docs.ocsjs.com',
			source: 'https://github.com/ocsjs/ocsjs',
			icon: 'https://cdn.ocsjs.com/logo.png',
			connect: ['enncy.cn', 'icodef.com', 'ocsjs.com', 'zaizhexue.top', 'localhost', '127.0.0.1', 'aliyuncs.com'],
			match,
			grant: [
				'GM_info',
				'GM_getTab',
				'GM_saveTab',
				'GM_setValue',
				'GM_getValue',
				'unsafeWindow',
				'GM_listValues',
				'GM_deleteValue',
				'GM_notification',
				'GM_xmlhttpRequest',
				'GM_getResourceText',
				'GM_addValueChangeListener',
				'GM_removeValueChangeListener'
			],
			require: [path.join(scriptsRoot, 'dist', 'index.js')],
			resource: [`STYLE ${cssPath}`],
			'run-at': 'document-start',
			antifeature: 'payment'
		},
		entry: path.join(scriptsRoot, 'entry.js'),
		dist: outputPath
	};
}

async function build() {
	run('pnpm exec tsc', utilsRoot);
	run('pnpm exec tsc', coreRoot);
	run('pnpm exec vite build', coreRoot, { VITE_BUILD_PATH: path.join(coreRoot, 'dist') });
	run('pnpm exec tsc', scriptsRoot);
	run('pnpm exec vite build', scriptsRoot, { VITE_BUILD_PATH: path.join(scriptsRoot, 'dist') });

	await require(path.join(ocsRoot, 'scripts', 'build-style')).build();
	require('browser-env')();
	globalThis.unsafeWindow = globalThis.unsafeWindow || {};

	const { createUserScript, createMetaFile } = require(utilsRoot);
	const ocs = require(path.join(scriptsRoot, 'dist', 'index.js'));
	const cssPath = path.join(scriptsRoot, 'assets', 'css', 'style.css');
	const scriptPath = path.join(webPublicRoot, 'ocs.user.js');
	const metaPath = path.join(webPublicRoot, 'ocs.meta.js');

	fs.mkdirSync(webPublicRoot, { recursive: true });
	fs.mkdirSync(appPublicRoot, { recursive: true });
	await createUserScript(createBuildOptions(ocs, cssPath, scriptPath));
	await createMetaFile({ dist: scriptPath, metaDist: metaPath });
	fs.copyFileSync(cssPath, path.join(webPublicRoot, 'style.css'));

	for (const fileName of ['ocs.user.js', 'ocs.meta.js', 'style.css']) {
		fs.copyFileSync(path.join(webPublicRoot, fileName), path.join(appPublicRoot, fileName));
	}
	console.log(`[ocsjs] 已生成 OCSJS v${version}，输出目录：${path.relative(desktopRoot, webPublicRoot)}`);
}

build().catch((error) => {
	console.error('[ocsjs] 内置浏览器资源构建失败', error);
	process.exitCode = 1;
});
