import { garageHeroZones, heroScene } from '../hero.config';

export const heroZones = garageHeroZones.map((zone, index) => ({
  ...zone,
  center: (index + 0.5) / garageHeroZones.length,
  x: (index - (garageHeroZones.length - 1) / 2) * heroScene.baySpacing,
}));

export function heroZoneAt(progress: number) {
  return Math.max(0, Math.min(heroZones.length - 1, Math.floor(progress * heroZones.length)));
}

export function heroCameraAt(progress: number, aspect: number, mobile: boolean) {
  const phase = progress * heroZones.length;
  // Keep some forward motion at each zone center so the camera never stops between stops.
  const glide =
    progress + (Math.sin(phase * 2 * Math.PI) * 0.66) / (heroZones.length * 2 * Math.PI);
  const x = (glide - 0.5) * heroScene.travel;
  const pullBack = Math.max(0, (progress - 0.84) / 0.16);
  const span = mobile ? heroScene.mobileSpan : heroScene.desktopSpan;
  const distance = Math.max(heroScene.minimumDistance, span / aspect);
  return {
    x: x * 1.7,
    y: 3.15 + pullBack * 0.24,
    z: distance + pullBack * 2.5,
    lookX: x * 0.6,
    lookY: mobile ? heroScene.compactLookY : heroScene.desktopLookY,
  };
}
