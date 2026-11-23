import { heroMotion } from './hero.config';

export function skipHeroToShop(target: HTMLElement, reduced: boolean) {
  target.focus({ preventScroll: true });
  const document = target.ownerDocument;
  const view = document.defaultView;
  if (!view || reduced) {
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    return undefined;
  }
  const input = new AbortController();
  const { signal } = input;
  const cancel = () => {
    input.abort();
    view.clearTimeout(timer);
  };
  const settle = () => {
    cancel();
    if (document.activeElement !== target) return;
    const { top } = target.getBoundingClientRect();
    if (top < 0 || top >= view.innerHeight)
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const timer = view.setTimeout(settle, heroMotion.skipSettleMs);
  document.addEventListener('scrollend', settle, { once: true, signal });
  for (const name of ['wheel', 'pointerdown', 'keydown']) {
    view.addEventListener(name, cancel, { passive: true, signal });
  }
  target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return cancel;
}
