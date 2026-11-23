import { garageHeroZones, heroSteps } from './hero.config';

type Direction = -1 | 1;
export const lastHeroZone = garageHeroZones.length - 1;

export function stepForKey(key: string) {
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  if (key === 'ArrowDown' || key === 'PageDown') return 1;
  if (key === 'ArrowUp' || key === 'PageUp') return -1;
  return undefined;
}

export function stepForSwipe(x: number, y: number): Direction | undefined {
  const axis = Math.abs(x) > Math.abs(y) ? x : y;
  const cross = axis === x ? y : x;
  if (
    Math.abs(axis) < Math.max(heroSteps.swipeDistancePx, Math.abs(cross) * heroSteps.swipeAxisRatio)
  )
    return undefined;
  return axis < 0 ? 1 : -1;
}

export function wheelPixels(
  {
    deltaMode,
    deltaX,
    deltaY,
    ctrlKey,
  }: Pick<WheelEvent, 'deltaMode' | 'deltaX' | 'deltaY' | 'ctrlKey'>,
  viewportHeight: number,
) {
  if (ctrlKey || !deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return undefined;
  const multiplier = deltaMode === 1 ? heroSteps.wheelLinePx : deltaMode === 2 ? viewportHeight : 1;
  return deltaY * multiplier;
}

interface StepOptions {
  index: () => number;
  move: (index: number, done: () => void) => void;
  release: (direction: Direction) => void;
  fail: () => void;
  now: () => number;
}

export function createHeroStepper(options: StepOptions) {
  let enabled = true;
  let moving = false;
  let unlockedAt = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let lastWheelAt = -Infinity;
  const wheelSamples: { time: number; delta: number }[] = [];
  let consumedDirection: Direction | undefined;

  const locked = () => moving || options.now() < unlockedAt;
  function disable() {
    enabled = false;
    moving = false;
    clearTimeout(watchdog);
  }
  function fail() {
    disable();
    options.fail();
  }
  function select(index: number) {
    if (!enabled || locked() || index === options.index()) return false;
    moving = true;
    watchdog = setTimeout(fail, heroSteps.stallMs);
    try {
      options.move(index, () => {
        if (!enabled || !moving) return;
        clearTimeout(watchdog);
        moving = false;
        unlockedAt = options.now() + heroSteps.cooldownMs;
      });
    } catch {
      fail();
    }
    return enabled;
  }
  function step(direction: Direction) {
    if (!enabled) return false;
    if (locked()) return true;
    const index = options.index() + direction;
    if (index < 0 || index > lastHeroZone) {
      options.release(direction);
      return true;
    }
    return select(index);
  }
  function wheel(delta: number, engage: (direction: Direction) => boolean) {
    if (!enabled) return false;
    const time = options.now();
    const direction = delta > 0 ? 1 : -1;
    if (time - lastWheelAt >= heroSteps.wheelQuietMs) {
      consumedDirection = undefined;
      wheelSamples.length = 0;
    }
    // Each vertical event postpones the end of the gesture, including momentum during a move.
    lastWheelAt = time;
    const strong = Math.abs(delta) >= heroSteps.wheelReversePx;
    if (locked()) {
      if (!consumedDirection || strong) consumedDirection = direction;
      wheelSamples.length = 0;
      return true;
    }
    if (consumedDirection) {
      if (!strong || direction === consumedDirection) return true;
      consumedDirection = undefined;
      wheelSamples.length = 0;
    }
    while (wheelSamples.length && time - wheelSamples[0].time > heroSteps.wheelSampleMs)
      wheelSamples.shift();
    wheelSamples.push({ time, delta });
    const total = wheelSamples.reduce((sum, sample) => sum + sample.delta, 0);
    if (Math.abs(total) >= heroSteps.wheelThresholdPx) {
      const next = total > 0 ? 1 : -1;
      if (engage(next)) consumedDirection = next;
      wheelSamples.length = 0;
    }
    return enabled;
  }
  return { select, step, wheel, disable };
}
