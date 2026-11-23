const categoryAnchor = /^(?:garage-tour|tour-(?:car|truck|bike|rc))$/;

export function followHeroSection(hero: HTMLElement): (() => void) | undefined {
  const document = hero.ownerDocument;
  const view = document.defaultView;
  const hash = view?.location.hash;
  const main = hero.closest('main');
  if (!view || !hash || !main) return;

  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }

  const target = document.getElementById(id);
  if (!target || !main.contains(target)) return;
  if (!categoryAnchor.test(id)) {
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    return;
  }

  return alignCategory(view, target);
}

function alignCategory(view: Window, target: HTMLElement) {
  function align() {
    // Category links use their measured margin once, independently of global scroll padding.
    const inset = parseFloat(view.getComputedStyle(target).scrollMarginTop) || 0;
    const offset = target.getBoundingClientRect().top - inset;
    if (Math.abs(offset) >= 1) view.scrollTo({ top: view.scrollY + offset, behavior: 'instant' });
  }
  align();
  // Native restoration and in-page fragment navigation can scroll again before the next paint.
  const frame = view.requestAnimationFrame(align);
  if (typeof ResizeObserver === 'undefined') return () => view.cancelAnimationFrame(frame);
  const scenes = target.closest('.category-scenes');
  const header = view.document.querySelector('app-store-header');
  const listeners = new AbortController();
  const { signal } = listeners;
  const sizes = new ResizeObserver(align);
  // Earlier loading grids can change the anchor's position. Keep it aligned until the shopper moves.
  scenes?.querySelectorAll('.category-scene').forEach((scene) => sizes.observe(scene));
  if (header) sizes.observe(header);
  function stop() {
    view.cancelAnimationFrame(frame);
    sizes.disconnect();
    listeners.abort();
  }
  for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
    view.addEventListener(event, stop, { passive: true, signal });
  }
  return stop;
}
