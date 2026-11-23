import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberHomeScroll, restoreHomeScroll } from './hero-history';

describe('home scroll restoration', () => {
  let main: HTMLElement;
  let hero: HTMLElement;
  let viewportY: number;
  let pageHeight: number;
  let onResize: () => void;
  let cancel: ReturnType<typeof restoreHomeScroll>;

  beforeEach(() => {
    vi.useFakeTimers();
    main = document.createElement('main');
    main.innerHTML =
      '<section class="hero"></section><div class="scene-products"><p role="status">Loading</p></div>';
    hero = main.querySelector('section')!;
    document.body.append(main);
    viewportY = 0;
    pageHeight = 1200;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => viewportY);
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => pageHeight);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) =>
      window.clearTimeout(frame),
    );
    vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
      viewportY = (options as ScrollToOptions).top ?? viewportY;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(update: () => void) {
          onResize = update;
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cancel?.stop();
    cancel = undefined;
    main.remove();
    sessionStorage.clear();
    history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('restores the saved mid-page offset after loading cards expand the page', () => {
    viewportY = 2200;
    rememberHomeScroll(window);
    viewportY = 510;
    cancel = restoreHomeScroll(window, hero);
    vi.advanceTimersByTime(32);
    expect(viewportY).toBe(510);
    pageHeight = 4600;
    main.querySelector('[role="status"]')?.remove();
    onResize();
    expect(viewportY).toBe(2200);
  });

  it('uses the session position on a full reload even if the router has only recreated its own state', () => {
    vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ]);
    viewportY = 1800;
    rememberHomeScroll(window, false);
    history.replaceState({ navigationId: 1 }, '', '/');
    viewportY = 0;
    pageHeight = 4600;
    main.querySelector('[role="status"]')?.remove();
    cancel = restoreHomeScroll(window, hero);
    vi.advanceTimersByTime(32);
    expect(viewportY).toBe(1800);
  });
});
