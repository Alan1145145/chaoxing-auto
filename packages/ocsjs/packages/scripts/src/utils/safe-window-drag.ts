import domDefault, * as domNamespace from 'easy-us/lib/utils/dom';

type DragFinish = (() => void) | undefined;
const installed = new WeakSet<HTMLElement>();
const interactive = 'button,a,input,select,textarea,summary,[role="button"],[role="combobox"],[contenteditable="true"],dropdown-element,.dropdown-option,.dropdown-trigger-element,.switch';

/** Replace only the legacy drag helpers; keep the existing window and menu rendering. */
export function enableSafeWindowDrag(header: HTMLElement, target: HTMLElement, onFinish?: DragFinish) {
	if (installed.has(header)) return;
	installed.add(header);
	header.addEventListener('pointerdown', (event) => {
		if (!event.isPrimary || event.button !== 0 || event.composedPath().some((node) =>
			node instanceof Element && node !== header && node.matches(interactive))) return;
		event.preventDefault();
		const id = event.pointerId;
		const initialX = event.clientX;
		const initialY = event.clientY;
		const initialLeft = target.offsetLeft;
		const initialTop = target.offsetTop;
		let latestX = initialX;
		let latestY = initialY;
		let moved = false;
		let ended = false;
		let animation = 0;
		const draw = () => {
			animation = 0;
			const dx = latestX - initialX;
			const dy = latestY - initialY;
			if (!moved && Math.hypot(dx, dy) < 4) return;
			moved = true;
			target.style.left = Math.min(Math.max(initialLeft + dx, 0), Math.max(0, innerWidth - 48)) + 'px';
			target.style.top = Math.min(Math.max(initialTop + dy, 10), Math.max(10, innerHeight - 32)) + 'px';
		};
		const finish = () => {
			if (ended) return;
			ended = true;
			if (animation) { cancelAnimationFrame(animation); draw(); }
			header.removeEventListener('pointermove', move);
			header.removeEventListener('pointerup', up);
			header.removeEventListener('pointercancel', up);
			header.removeEventListener('lostpointercapture', finish);
			window.removeEventListener('blur', finish);
			window.removeEventListener('pagehide', finish);
			try { if (header.hasPointerCapture(id)) header.releasePointerCapture(id); } catch { /* Detached header. */ }
			if (moved) onFinish?.();
		};
		const move = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			if (next.pointerType === 'mouse' && (next.buttons & 1) === 0) { finish(); return; }
			latestX = next.clientX; latestY = next.clientY;
			if (!animation) animation = requestAnimationFrame(draw);
		};
		const up = (next: PointerEvent) => { if (next.pointerId === id) finish(); };
		try { header.setPointerCapture(id); } catch { return; }
		header.addEventListener('pointermove', move);
		header.addEventListener('pointerup', up);
		header.addEventListener('pointercancel', up);
		header.addEventListener('lostpointercapture', finish);
		window.addEventListener('blur', finish);
		window.addEventListener('pagehide', finish);
	});
}

// easy-us ships CommonJS with __esModule but no default; support both tsc and Rollup interop.
const dom = domDefault || domNamespace;
if (!Reflect.set(dom, 'enableElementDraggable', enableSafeWindowDrag) ||
	!Reflect.set(dom, 'enableElementTouchDraggable', enableSafeWindowDrag)) {
	throw new Error('无法安装 OCS 窗口拖动兼容层');
}
