import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import commonjs from 'vite-plugin-commonjs';

import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		outDir: '../app/public',
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules')) {
						return id.toString().split('node_modules/')[1].split('/')[0].toString();
					}
				}
			}
		},
		/** 是否压缩代码， 这里写 false，不然打包后类名会发生变化 */
		minify: false
	},
	server: {
		open: false,
		watch: {
			// 课程脚本由独立构建注入，改动时不要整页重载桌面端。
			ignored: ['**/ocsjs/**']
		}
	},
	base: '',
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			// The workspace packages publish CommonJS from lib/, which must not be served as a browser module.
			'@ocsjs/scripts': path.resolve(__dirname, '../ocsjs/packages/scripts/src/index.ts'),
			'@ocsjs/core': path.resolve(__dirname, '../ocsjs/packages/core/src/index.ts'),
			root: path.resolve(__dirname),
			app: path.resolve(__dirname, './app')
		}
	},
	plugins: [commonjs({ filter: (id) => (id.includes('xlsx') ? undefined : false) }), vue(), visualizer()]
});
