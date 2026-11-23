import { stepForSwipe } from './hero-gesture';

export function createHeroSwipe(swipe: (direction: -1 | 1, vertical: boolean) => void) {
  let start: { id: number; x: number; y: number } | undefined;
  return {
    start(event: PointerEvent) {
      if (!['touch', 'pen'].includes(event.pointerType) || !event.isPrimary) return;
      if (event.target instanceof Element && event.target.closest('a, button')) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    end(event: PointerEvent) {
      if (!start || start.id !== event.pointerId) return;
      const x = event.clientX - start.x;
      const y = event.clientY - start.y;
      start = undefined;
      if (event.type === 'pointercancel') return;
      const direction = stepForSwipe(x, y);
      if (direction) swipe(direction, Math.abs(x) <= Math.abs(y));
    },
  };
}
