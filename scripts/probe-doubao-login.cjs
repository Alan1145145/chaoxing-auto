// One live QR creation request. Does not log in or send any chat messages.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const profile = path.resolve(__dirname, '../docs/doubao-integration/test-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.whenReady().then(async () => {
	try {
		const service = require('../packages/app/lib/src/services/doubao');
		const result = await service.startDoubaoQr();
		if (!result.token || !result.image.startsWith('data:image/png;base64,')) throw new Error('Unexpected QR response');
		console.log('PASS: bundled gateway created a live Doubao QR code. Token and image are not logged.');
	} catch (e) {
		process.exitCode = 1;
		console.error(String(e));
	} finally {
		app.quit();
	}
});
