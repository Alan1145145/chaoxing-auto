/** One delegated listener, shared by native and Arco buttons. Never touches course webviews. */
export function installInteractionFeedback() {
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	document.addEventListener(
		'pointerdown',
		(event) => {
			if (event.button !== 0 || reducedMotion.matches || !(event.target instanceof Element)) return;
			const button = event.target.closest<HTMLElement>('button, .arco-btn');
			if (!button || button.matches(':disabled, [aria-disabled="true"], .arco-btn-disabled')) return;
			const bounds = button.getBoundingClientRect();
			const ripple = document.createElement('span');
			ripple.className = 'interaction-ripple';
			ripple.setAttribute('aria-hidden', 'true');
			const diameter = Math.min(Math.max(bounds.width, bounds.height), 110);
			ripple.style.cssText = `width:${diameter}px;height:${diameter}px;left:${event.clientX - diameter / 2}px;top:${
				event.clientY - diameter / 2
			}px`;
			document.body.appendChild(ripple);
			ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
			window.setTimeout(() => ripple.remove(), 700);
		},
		{ passive: true }
	);
}
