import { type Router, NavigationEnd, NavigationStart } from '@angular/router';
import { rememberHomeScroll, restoreHomeScroll } from './hero-history';

const hintKey = 'garageScrollHintShown';

export function firstGarageHint(view: Window | null) {
  try {
    if (!view || view.sessionStorage.getItem(hintKey)) return false;
    view.sessionStorage.setItem(hintKey, '1');
    return true;
  } catch {
    return false;
  }
}

interface HeroArrivalOptions {
  hero: HTMLElement;
  router: Router;
  media: MediaQueryList | undefined;
  updateMode: () => void;
  entered: () => boolean;
  enter: () => void;
  followSection: () => void;
  zone: () => number;
  synchronizeZone: () => void;
  restoreZone: () => void;
  paint: () => void;
  idle: () => void;
}

export function watchHeroArrival(options: HeroArrivalOptions) {
  const { hero, router, media, updateMode, entered, followSection } = options;
  const view = hero.ownerDocument.defaultView;
  if (!view) return () => undefined;
  const events = new AbortController();
  const { signal } = events;
  let secondFrame = 0;
  let idle = 0;
  let timer = 0;
  let returning = false;

  const cancelRestore = restoreHomeScroll(view, hero);
  let lastSnapshot = -Infinity;
  const remember = () => {
    if (!cancelRestore?.pending()) rememberHomeScroll(view, true, options.zone());
  };

  const routes = router.events.subscribe((event) => {
    if (event instanceof NavigationStart) {
      returning = event.navigationTrigger === 'popstate';
      if (!returning) {
        remember();
      }
    }
    if (event instanceof NavigationEnd && entered()) {
      followSection();
      if (returning) options.restoreZone();
    }
  });

  media?.addEventListener('change', updateMode, { signal });
  view.addEventListener(
    'hashchange',
    () => {
      if (entered()) followSection();
    },
    { signal },
  );
  view.addEventListener(
    'scroll',
    () => {
      options.synchronizeZone();
      const now = view.performance.now();
      if (!cancelRestore?.pending() && now - lastSnapshot >= 100) {
        lastSnapshot = now;
        rememberHomeScroll(view, false, options.zone());
      }
    },
    { passive: true, signal },
  );
  view.addEventListener('pagehide', remember, { signal });
  view.document.addEventListener(
    'visibilitychange',
    () => {
      if (view.document.hidden) remember();
    },
    { signal },
  );
  view.document.addEventListener('scrollend', remember, { signal });

  const frame = view.requestAnimationFrame(() => {
    options.synchronizeZone();
    if (!hero.ownerDocument.documentElement.classList.contains('garage-intro-open'))
      options.enter();
    secondFrame = view.requestAnimationFrame(() => {
      options.paint();
      if (typeof view.requestIdleCallback === 'function')
        idle = view.requestIdleCallback(options.idle, { timeout: 1600 });
      else timer = view.setTimeout(options.idle, 250);
    });
  });
  return () => {
    view.cancelAnimationFrame(frame);
    view.cancelAnimationFrame(secondFrame);
    if (idle) view.cancelIdleCallback(idle);
    if (timer) view.clearTimeout(timer);
    events.abort();
    cancelRestore?.stop();
    routes.unsubscribe();
  };
}
