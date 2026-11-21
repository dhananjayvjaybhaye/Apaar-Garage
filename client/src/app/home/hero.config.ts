// Layout lengths are shared by the hero and its overlapping featured section.
export const heroLayout = {
  maxWidth: '80rem',
  height: '87svh',
  mobileScene: 'clamp(15rem, 50svh, 31rem)',
  desktopScene: 'clamp(16rem, 51svh, 34rem)',
  columnsAtRem: 56,
  overlap: 'clamp(1rem, 3vw, 2.4rem)',
} as const;

// Animation times are seconds. Scroll and travel values are fractions of the hero height.
export const heroMotion = {
  entrance: 0.8,
  entranceStagger: 0.09,
  reducedFade: 0.22,
  scrub: 0.34,
  scrollDistance: 0.82,
  copyLag: 0.4,
  sceneLift: 0.07,
  sceneScale: 0.94,
  sceneEntranceScale: 0.96,
  glowFadeEnd: 0.85,
  controlsFadeStart: 0.5,
  controlsLiftPx: 12,
  featuredRiseStart: 0.4,
  featuredLiftPx: 32,
} as const;

// Lens angle in degrees. Distances are Three.js world units.
export const heroCamera = {
  fieldOfView: 43,
  caseHalfWidth: 2.8,
  rcTrackFrontEdge: 4.2,
  scrollDolly: 1.6,
  tabSeconds: 0.85,
  inspectionSeconds: 0.55,
  inspectionSnapshotMs: 80,
} as const;
