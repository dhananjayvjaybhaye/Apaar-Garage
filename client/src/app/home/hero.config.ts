import type { GarageZone } from './garage/garage-path';

export const garageHeroZones = [
  { category: 'car', name: 'Cars', sign: 'CARS' },
  { category: 'truck', name: 'Trucks', sign: 'TRUCKS' },
  { category: 'bike', name: 'Bikes', sign: 'BIKES' },
  { category: 'rc', name: 'RC', sign: 'RC TOYS' },
] as const satisfies ReadonlyArray<{ category: GarageZone; name: string; sign: string }>;

// The existing overlap belongs to the section immediately below the hero.
export const heroLayout = {
  overlap: 'clamp(1rem, 3vw, 2.4rem)',
  copyClearance: '24px',
} as const;

// Durations are seconds. Scroll length is in viewport heights.
export const heroMotion = {
  entrance: 0.8,
  entranceStagger: 0.075,
  reducedFade: 0.22,
  scrub: 0.32,
  // One viewport of scroll per zone.
  scrollDistance: garageHeroZones.length,
  exitStart: 0.9,
  exitLiftPx: 24,
  swipeDistancePx: 48,
  swipeAxisRatio: 1.35,
} as const;

// Product modal camera timing in seconds and milliseconds.
export const heroCamera = {
  inspectionSeconds: 0.55,
  inspectionSnapshotMs: 80,
} as const;

// Lens angle in degrees. Distances and offsets are Three.js world units.
export const heroScene = {
  fieldOfView: 43,
  desktopDpr: 2,
  mobileDpr: 1.25,
  baySpacing: 4.72,
  desktopOffset: 0.165,
  mobileOffset: 0,
  travel: 2.6,
  minimumDistance: 16,
  desktopSpan: 44,
  mobileSpan: 28,
  compactLookY: 4.55,
  desktopLookY: 3.05,
  maximumCompactAspect: 1.25,
  dragRangePx: 95,
  parallax: 0.3,
  drift: 0.08,
  driftCycleMs: 6400,
  neonCycleMs: 4900,
  dustCycleMs: 18000,
  dustCount: 34,
  mobileDustCount: 14,
  activeLight: 27,
  idleLight: 7,
  hoverLight: 11,
  planeSwayCycleMs: 5700,
  planeSwayRadians: 0.065,
  colors: {
    haze: '#1a1c24',
    wall: '#32343b',
    metal: '#202126',
    bench: '#34343a',
    floor: '#3d3f46',
    ambient: '#bcc8ed',
    warm: '#ffd7a0',
    strip: '#ffe4ba',
    rail: '#ef4825',
    neon: '#ff3238',
    neonFace: '#ff9d90',
  },
} as const;

// Idle callbacks yield between inactive bench photos. Values are milliseconds.
export const benchMedia = { idleTimeout: 600, timerFallback: 50 } as const;
