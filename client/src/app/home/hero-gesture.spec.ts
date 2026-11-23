import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heroSteps } from './hero.config';
import {
  createHeroStepper,
  lastHeroZone,
  stepForKey,
  stepForSwipe,
  wheelPixels,
} from './hero-gesture';
import { attachHeroInput, savedHeroZone } from './hero-scroll';

function controls(start = 0) {
  let index = start;
  const move = vi.fn((next: number, done: () => void) => {
    index = next;
    setTimeout(done, heroSteps.moveMs);
  });
  const release = vi.fn();
  const fail = vi.fn();
  const stepper = createHeroStepper({ index: () => index, move, release, fail, now: Date.now });
  return { ...stepper, move, release, fail, index: () => index };
}

describe('garage hero gesture handling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes one step for a burst, drops inertia after unlock, then accepts a fresh gesture', () => {
    const hero = controls();
    const wheel = (delta: number) => hero.wheel(delta, hero.step);
    for (let pulse = 0; pulse < 20; pulse++) {
      wheel(190);
      vi.advanceTimersByTime(20);
    }
    expect(hero.move).toHaveBeenCalledTimes(1);
    expect(hero.index()).toBe(1);
    for (let elapsed = 0; elapsed < heroSteps.moveMs; elapsed += 35) {
      wheel(35);
      vi.advanceTimersByTime(35);
    }
    expect(hero.move).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(heroSteps.wheelQuietMs);
    wheel(2);
    expect(hero.index()).toBe(1);
    wheel(100);
    expect(hero.index()).toBe(2);
  });

  it('ignores competing selections and gestures until the current move and cooldown finish', () => {
    const hero = controls();
    expect(hero.select(2)).toBe(true);
    expect(hero.select(3)).toBe(false);
    hero.step(-1);
    vi.advanceTimersByTime(heroSteps.moveMs);
    expect(hero.select(3)).toBe(false);
    vi.advanceTimersByTime(heroSteps.cooldownMs);
    expect(hero.select(3)).toBe(true);
    expect(hero.index()).toBe(3);
  });

  function swipe(hero: ReturnType<typeof controls>, samples: number[], spacingMs: number) {
    for (const delta of samples) {
      hero.wheel(delta, hero.step);
      vi.advanceTimersByTime(spacingMs);
    }
  }

  it('steps immediately for a mouse notch in pixel, line or page units', () => {
    for (const [deltaY, deltaMode] of [
      [120, 0],
      [3, 1],
      [1, 2],
    ]) {
      const hero = controls();
      const delta = wheelPixels({ deltaY, deltaMode, deltaX: 0, ctrlKey: false }, 900)!;
      expect(delta).toBeGreaterThanOrEqual(heroSteps.wheelThresholdPx);
      hero.wheel(delta, hero.step);
      expect(hero.move).toHaveBeenCalledOnce();
    }
  });

  it('takes one step for a 1.5 second trackpad swipe with a spaced inertia tail', () => {
    const hero = controls();
    swipe(hero, Array<number>(12).fill(7), 8);
    swipe(
      hero,
      Array.from({ length: 16 }, (_, i) => 20 - i / 3),
      88,
    );
    expect(hero.move).toHaveBeenCalledOnce();
    expect(hero.index()).toBe(1);
  });

  it('accumulates a light swipe in 100 ms and drops older samples', () => {
    const hero = controls();
    swipe(hero, [14, 14, 14, 14, 14], 55);
    expect(hero.index()).toBe(0);
    vi.advanceTimersByTime(heroSteps.wheelQuietMs);
    swipe(hero, Array<number>(10).fill(4.25), 10);
    expect(hero.move).toHaveBeenCalledOnce();
  });

  it('recognizes two swipes separated by a pause after the camera move', () => {
    const hero = controls();
    swipe(hero, Array<number>(10).fill(5), 10);
    vi.advanceTimersByTime(heroSteps.moveMs + heroSteps.cooldownMs);
    swipe(hero, Array<number>(10).fill(5), 10);
    expect(hero.index()).toBe(2);
  });

  it('ignores a reverse swipe during the lock and accepts a later deliberate swipe', () => {
    const hero = controls();
    swipe(hero, [120, -110, -85], 20);
    expect(hero.index()).toBe(1);
    vi.advanceTimersByTime(heroSteps.moveMs + heroSteps.cooldownMs);
    swipe(hero, [-90], 20);
    expect(hero.index()).toBe(0);
  });

  it('accepts a strong reversal after a completed move while old inertia is still arriving', () => {
    const hero = controls();
    swipe(hero, [120], 0);
    swipe(hero, Array<number>(14).fill(15), 90);
    expect(hero.index()).toBe(1);
    swipe(hero, [-90], 0);
    expect(hero.index()).toBe(0);
  });

  it('rejects taps, short or diagonal swipes and accepts deliberate horizontal and vertical swipes', () => {
    expect(stepForSwipe(0, 0)).toBeUndefined();
    expect(stepForSwipe(-39, 0)).toBeUndefined();
    expect(stepForSwipe(42, 39)).toBeUndefined();
    expect(stepForSwipe(-40, 10)).toBe(1);
    expect(stepForSwipe(0, 45)).toBe(-1);
    expect(stepForSwipe(10, -50)).toBe(1);
  });

  it.each([
    ['ArrowDown', 1],
    ['PageDown', 1],
    ['ArrowUp', -1],
    ['PageUp', -1],
    ['Home', 'first'],
    ['End', 'last'],
    [' ', undefined],
    ['ArrowRight', undefined],
    ['ArrowLeft', undefined],
    ['Escape', undefined],
  ] as const)('maps keyboard input %s while leaving unrelated keys alone', (key, result) => {
    expect(stepForKey(key)).toBe(result);
  });

  it.each([
    [0, -1],
    [lastHeroZone, 1],
  ] as const)('releases the page at zone %s', (index, direction) => {
    const hero = controls(index);
    expect(hero.step(direction)).toBe(true);
    expect(hero.release).toHaveBeenCalledOnce();
    expect(hero.release).toHaveBeenCalledWith(direction);
    expect(hero.move).not.toHaveBeenCalled();
  });
});

describe('garage hero page integration', () => {
  let hero: HTMLElement;
  let destroy: () => void;
  let y: number;
  let index: number;
  let move: ReturnType<typeof vi.fn<(next: number, done: () => void) => void>>;
  let seek: ReturnType<typeof vi.fn<(next: number) => void>>;
  let scrollTo: ReturnType<typeof vi.spyOn>;

  function wheel(delta: number, target: EventTarget = hero, options: WheelEventInit = {}) {
    const event = new WheelEvent('wheel', {
      deltaY: delta,
      cancelable: true,
      bubbles: true,
      ...options,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    y = 0;
    index = 0;
    hero = document.createElement('section');
    document.body.append(hero);
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
    vi.spyOn(hero, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ x: 0, y: 60 - y, width: 1200, height: 680 }),
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) =>
      window.clearTimeout(frame),
    );
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
      y = (options as ScrollToOptions).top ?? y;
      window.dispatchEvent(new Event('scroll'));
    });
    move = vi.fn((next) => {
      index = next;
    });
    seek = vi.fn((next) => {
      index = next;
    });
    destroy = attachHeroInput({
      hero,
      headerHeight: () => 60,
      index: () => index,
      move,
      seek,
      fail: vi.fn(),
    }).destroy;
  });
  afterEach(() => {
    destroy();
    hero.remove();
    history.replaceState(null, '', '/');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('lets pinch zoom, horizontal gestures, and wheels away from a transfer pass through', () => {
    expect(wheel(90, hero, { ctrlKey: true })).toBe(false);
    expect(wheel(14, hero, { deltaX: 100 })).toBe(false);
    expect(wheel(120, document.body)).toBe(false);
    expect(move).not.toHaveBeenCalled();
  });

  it('unlocks normal wheel scrolling after a stalled or failed camera move', () => {
    expect(wheel(100)).toBe(true);
    expect(index).toBe(1);
    vi.advanceTimersByTime(heroSteps.stallMs);
    expect(wheel(100)).toBe(false);
    expect(move).toHaveBeenCalledOnce();
  });

  function scrollNormally(to: number) {
    y = to;
    window.dispatchEvent(new Event('scroll'));
  }

  function key(key: string, target: HTMLElement = document.body) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('scrolls natively below the garage, then eases back to RC when crossing its bottom edge', () => {
    scrollNormally(1000);
    expect(wheel(-95, document.body)).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
    scrollNormally(710);
    expect(wheel(-70, document.body)).toBe(true);
    expect(y).toBe(710);
    vi.advanceTimersByTime(heroSteps.transferMs / 2);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(710);
    vi.advanceTimersByTime(heroSteps.transferMs / 2 + 40);
    expect(y).toBe(0);
    expect(seek).toHaveBeenCalledWith(lastHeroZone);
    expect(move).not.toHaveBeenCalled();
  });

  it('eases the exit and suppresses remaining momentum even outside the hero', () => {
    index = lastHeroZone;
    expect(wheel(120)).toBe(true);
    expect(y).toBe(0);
    vi.advanceTimersByTime(heroSteps.transferMs / 2);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(680);
    expect(wheel(120, document.body)).toBe(true);
    vi.advanceTimersByTime(heroSteps.transferMs / 2 + 40);
    expect(y).toBe(680 + heroSteps.settleTolerancePx);
    expect(wheel(70, document.body)).toBe(false);
  });

  it('releases the page if the controlled handoff stops producing frames', () => {
    index = lastHeroZone;
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(71);
    expect(wheel(120)).toBe(true);
    expect(wheel(120, document.body)).toBe(true);
    vi.advanceTimersByTime(heroSteps.stallMs);
    expect(wheel(120)).toBe(false);
  });
  it('settles an 18 px offset smoothly before honoring the first wheel gesture', () => {
    scrollNormally(18);
    expect(wheel(100)).toBe(true);
    expect(y).toBe(18);
    expect(move).not.toHaveBeenCalled();
    vi.advanceTimersByTime(heroSteps.alignMs + 40);
    expect(y).toBe(0);
    expect(move).toHaveBeenCalledExactlyOnceWith(1, expect.any(Function));
  });

  it('lets Space and horizontal arrows through, and leaves keys on interactive targets alone', () => {
    expect(key(' ')).toBe(false);
    expect(key('ArrowLeft')).toBe(false);
    expect(key('ArrowRight')).toBe(false);
    for (const tag of ['button', 'input', 'a']) {
      const control = document.createElement(tag);
      hero.append(control);
      expect(key('PageDown', control)).toBe(false);
    }
    scrollNormally(120);
    expect(key('ArrowDown')).toBe(false);
    scrollNormally(0);
    expect(key('PageDown')).toBe(true);
    expect(move).toHaveBeenCalledOnce();
  });

  it('allows native keyboard controls on inputs and while a modal is open', () => {
    const input = document.createElement('input');
    hero.append(input);
    const inInput = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    input.dispatchEvent(inInput);
    expect(inInput.defaultPrevented).toBe(false);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.open = true;
    hero.append(dialog);
    expect(wheel(100, dialog)).toBe(false);
    expect(move).not.toHaveBeenCalled();
    dialog.open = false;
    expect(wheel(100)).toBe(true);
    expect(move).toHaveBeenCalledOnce();
  });

  it('reads a saved zone immediately without converting scroll distance to a zone', () => {
    history.replaceState({ garageHeroZone: 2 }, '', '/');
    expect(savedHeroZone(window)).toBe(2);
    history.replaceState({ garageHeroZone: 2 }, '', '/#tour-bike');
    expect(savedHeroZone(window)).toBeUndefined();
  });
});
