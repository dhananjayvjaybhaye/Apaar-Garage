import type { GarageZone } from './garage/garage-path';

// Fraction of the garage opening to the right of the dark copy area.
export const activeZoneFill = 0.53;
// Minimum clearance between the neon sign and the top of the canvas, in CSS pixels.
export const signTopMargin = 24;

const baySpacing = 4.84;

// Zone 0 is Cars. Camera X positions are Three.js world units.
export const garageHeroZones = [
  { category: 'car', name: 'Cars', sign: 'CARS', x: -1.5 * baySpacing },
  { category: 'truck', name: 'Trucks', sign: 'TRUCKS', x: -0.5 * baySpacing },
  { category: 'bike', name: 'Bikes', sign: 'BIKES', x: 0.5 * baySpacing },
  { category: 'rc', name: 'RC', sign: 'RC TOYS', x: 1.5 * baySpacing },
] as const satisfies ReadonlyArray<{ category: GarageZone; name: string; sign: string; x: number }>;

// The existing overlap belongs to the section immediately below the hero.
export const heroLayout = {
  overlap: 'clamp(1rem, 3vw, 2.4rem)',
  copyClearance: '24px',
  automaticGarageQuery: '(min-width: 56rem) and (min-height: 28rem) and (pointer: fine)',
  desktopControlsQuery: '(min-width: 56rem) and (pointer: fine)',
  // Keep the camera composition in step with the stacked hero's CSS breakpoint.
  stackedWidthPx: 896,
} as const;

export const heroMotion = {
  sceneFadeMs: 600,
  // Native smooth scroll normally finishes sooner. This also covers browsers without scrollend.
  skipSettleMs: 1400,
} as const;

export const heroTransfer = {
  attribute: 'data-garage-transfer',
  event: 'garage-transfer',
} as const;

export const heroSteps = {
  // Hold input during the dolly and for a short cooldown. A stalled dolly fails open.
  moveMs: 1050,
  cooldownMs: 150,
  stallMs: 3000,
  // Recognize a new wheel gesture after a quiet gap. Trackpad inertia extends this gap.
  wheelQuietMs: 120,
  // Accumulate normalized pixels within this rolling time window, in milliseconds.
  wheelSampleMs: 100,
  wheelThresholdPx: 40,
  // A deliberate reversal can start a new gesture once the camera is unlocked.
  wheelReversePx: 72,
  wheelLinePx: 16,
  swipeDistancePx: 40,
  swipeAxisRatio: 1.35,
  // Allow a slightly offset anchor. Ease the correction and the page handoff separately.
  anchorTolerancePx: 24,
  settleTolerancePx: 2,
  alignMs: 200,
  transferMs: 700,
  // Cap the elapsed time per painted frame so a delayed frame cannot jump to the end.
  maxTravelFrameMs: 80,
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
  mobileDpr: 1,
  // Canvas texture widths in pixels for shelf signs, floor glows and light cones.
  desktopTextureWidth: 512,
  mobileTextureWidth: 256,
  // These are fractions of the canvas. The opening excludes the copy and its gradient.
  desktopFrame: { x: 0.685, y: 0.525, heightFill: 0.63, openingWidth: 0.68 },
  // On stacked screens pull back and leave space for the copy above the display.
  compactFrame: { x: 0.53, y: 0.585, heightFill: 0.45, widthFill: 0.61 },
  crossingCenterShift: 0.055,
  frameEdgePadding: 0.035,
  // The bounds include the raised label, the scaled case and room for pointer parallax.
  caseHeight: 4.2,
  caseHalfWidth: 2.52,
  caseFront: -0.19,
  cameraTargetY: 1.94,
  // The single neon plane tracks the dolly along the back wall, above the case labels.
  neonSign: { width: 6.2, height: 1.22, xOffset: -3.38, compactXOffset: -1.7, y: 6.15, z: -5.08 },
  // The plane hangs above and to the right of the RC display. The bounds include its sway.
  rcPlane: {
    xOffset: 1.38,
    hangerY: 6.43,
    z: -1.65,
    drop: 1.4,
    halfWidth: 1.32,
    bottom: 4.77,
    top: 5.38,
    front: -0.86,
    back: -2.45,
  },
  // World units reserved for pointer motion and gentle scene drift.
  framingClearance: 0.24,
  cameraRise: 0.32,
  cameraSide: 0.16,
  crossingDolly: 0.44,
  dragRangePx: 95,
  parallax: 0.3,
  drift: 0.08,
  driftCycleMs: 6400,
  neonCycleMs: 4900,
  dustCycleMs: 18000,
  dustCount: 34,
  mobileDustCount: 14,
  activeLight: 27,
  // Relative brightness and scale, interpolated when the active zone changes.
  inactiveBrightness: 0.6,
  activeScale: 1.04,
  activeLabelScale: 1.37,
  activeLabelGlow: 0.92,
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

export const benchMedia = {
  // Idle callbacks yield between inactive bench photos. Values are milliseconds.
  idleTimeout: 600,
  timerFallback: 50,
  // Longest edge in pixels for product photos uploaded to the GPU.
  mobilePhotoSize: 256,
  desktopPhotoSize: 512,
} as const;
