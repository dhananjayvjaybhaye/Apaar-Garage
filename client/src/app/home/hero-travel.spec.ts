import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHeroTravel } from './hero-travel';
import { heroSteps } from './hero.config';

describe('controlled garage scroll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts at the original position even if the first paint is late', () => {
    let tick!: FrameRequestCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      tick = callback;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const travel = createHeroTravel(window, vi.fn());
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    travel.start(740, heroSteps.transferMs);
    tick(1400);
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    tick(2200);
    const position = (scroll.mock.lastCall?.[0] as ScrollToOptions).top ?? 0;
    expect(position).toBeGreaterThan(0);
    expect(position).toBeLessThan(200);
    travel.cancel();
  });
});
