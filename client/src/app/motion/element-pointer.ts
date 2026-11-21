import type { Motion } from './motion';

export function clamp(value: number) {
  return Math.min(1, Math.max(-1, value));
}

export function elementPointer(element: HTMLElement, motion: Motion, move: (x: number, y: number) => void, reset: () => void) {
  const listeners = new AbortController();
  const signal = listeners.signal;
  let bounds: DOMRect | undefined;
  const view = element.ownerDocument.defaultView;
  let scrollX = 0;
  let scrollY = 0;
  const leave = () => {
    bounds = undefined;
    motion.cancel(element);
    reset();
  };

  motion.zone.runOutsideAngular(() => {
    element.addEventListener('pointermove', (event) => {
      if (motion.level() !== 'full' || event.pointerType !== 'mouse') return;
      if (element.matches(':disabled,[aria-disabled="true"]')) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select')) {
        leave();
        return;
      }
      const { clientX, clientY } = event;
      motion.schedule(element, () => {
        if (motion.level() !== 'full' || !element.isConnected) return;
        if (!bounds || scrollX !== view?.scrollX || scrollY !== view?.scrollY) {
          bounds = element.getBoundingClientRect();
          scrollX = view?.scrollX ?? 0;
          scrollY = view?.scrollY ?? 0;
        }
        if (!bounds.width || !bounds.height) return;
        const x = clamp((clientX - bounds.left) / bounds.width * 2 - 1);
        const y = clamp((clientY - bounds.top) / bounds.height * 2 - 1);
        move(x, y);
      });
    }, { passive: true, signal });
    element.addEventListener('pointerleave', leave, { signal });
    element.addEventListener('pointercancel', leave, { signal });
    element.addEventListener('blur', leave, { signal });
  });
  return () => {
    listeners.abort();
    leave();
  };
}
