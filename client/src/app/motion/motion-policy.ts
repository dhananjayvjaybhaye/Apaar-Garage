import { mediaQuery, reducedMotionQuery } from '../ui/media-query';

export const motionQueries = [
  reducedMotionQuery,
  '(hover: hover) and (pointer: fine)',
  '(min-width: 52rem)',
] as const;

export type MotionLevel = 'full' | 'light' | 'reduced';

export function motionLevel(view: Window | null): MotionLevel {
  if (!view) return 'light';
  const [reduced, mouse, desktop] = motionQueries.map((query) => mediaQuery(query, view)?.matches);
  if (reduced) return 'reduced';
  const device = view.navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const constrained = device.connection?.saveData ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency > 0 && device.hardwareConcurrency < 4);
  return mouse && desktop && !constrained ? 'full' : 'light';
}
