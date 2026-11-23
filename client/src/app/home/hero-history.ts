const scrollKey = 'garageHomeScroll';
export const heroZoneHistoryKey = 'garageHeroZone';
const handledReload = new WeakSet<Window>();

function isHome(view: Window) {
  return view.location.pathname === '/' && !view.location.hash;
}

export function rememberHomeScroll(view: Window, inHistory = true, zone?: number) {
  if (!isHome(view)) return;
  const y = view.scrollY;
  try {
    view.sessionStorage.setItem(scrollKey, String(y));
    if (zone !== undefined) view.sessionStorage.setItem(heroZoneHistoryKey, String(zone));
  } catch {
    // Browser storage can be disabled. Router history still handles same-document navigation.
  }
  const state = view.history.state;
  if (
    inHistory &&
    (state?.[scrollKey] !== y || (zone !== undefined && state?.[heroZoneHistoryKey] !== zone))
  ) {
    view.history.replaceState(
      {
        ...state,
        [scrollKey]: y,
        ...(zone === undefined ? {} : { [heroZoneHistoryKey]: zone }),
      },
      '',
    );
  }
}

export function restoreHomeScroll(view: Window, hero: HTMLElement) {
  if (!isHome(view)) return undefined;
  const navigation = view.performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  let saved: unknown = view.history.state?.[scrollKey];
  // A full reload can copy history before the last scroll event. Read the live session snapshot
  // once per document. Same-document Back uses the specific history entry.
  if (
    !handledReload.has(view) &&
    navigation?.type === 'reload' &&
    (!navigation.name || new URL(navigation.name).pathname === '/')
  ) {
    handledReload.add(view);
    try {
      const reload = view.sessionStorage.getItem(scrollKey);
      if (reload !== null) saved = Number(reload);
    } catch {
      // Fall back to the entry's own history state.
    }
  }
  if (typeof saved !== 'number' || !Number.isFinite(saved) || saved <= 0) return undefined;
  const top = saved;
  const main = hero.closest('main');
  const input = new AbortController();
  let observer: ResizeObserver | undefined;
  let frame = 0;

  function stop() {
    observer?.disconnect();
    view.cancelAnimationFrame(frame);
    input.abort();
  }
  function restore() {
    if (input.signal.aborted) return;
    // Wait for the real grids so the restored viewport is not rearranged by their skeletons.
    if (main?.querySelector('.scene-products [role="status"], #featured [role="status"]')) return;
    const max = view.document.documentElement.scrollHeight - view.innerHeight;
    const destination = Math.min(top, Math.max(0, max));
    if (Math.abs(view.scrollY - destination) > 2)
      view.scrollTo({ top: destination, behavior: 'instant' });
    stop();
  }

  if (main && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(restore);
    observer.observe(main);
  }
  for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
    view.addEventListener(event, stop, { passive: true, signal: input.signal });
  }
  // Reapply after the browser's initial history restoration for the skeleton layout.
  frame = view.requestAnimationFrame(() => {
    frame = view.requestAnimationFrame(restore);
  });
  return { stop, pending: () => !input.signal.aborted };
}
