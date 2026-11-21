// Layout dimensions are CSS lengths. Timing values are seconds or milliseconds as named.
export const tourConfig = {
  desktopStageHeight: '76svh',
  desktopControlsClearance: '8rem', // Reserve space below the frame for the tabs and chip.
  mobileStageHeight: '40svh',
  blockHeight: '75svh',
  desktopAtRem: 56,
  stickyGapPx: 12,
  crossingClearancePx: 12,
  tabCrossingInsetPx: 24,
  exitFadePx: 140,
  frameEnterPx: 130,
  canvasLeadPx: 48, // Start the 3D view just before the sticky frame reaches the header.
  scrubSeconds: 0.32, // Smooth the camera and layers without affecting the scrollbar.
  frameScale: 0.975,
  frameTiltDegrees: 2,
  glowTravelPx: 22,
  beamTravelPx: 44,
  dustTravelPx: 78,
  glowOpacity: 0.24,
  beamOpacity: 0.17,
  depthOpacity: 0.18,
  dustOpacity: 0.22,
  glowLoopSeconds: 20,
  beamLoopSeconds: 15,
  dustLoopSeconds: 12,
  chipMs: 190,
  imageFadeMs: 260,
  reducedFadeMs: 120,
  revealMs: 240,
} as const;

// Field of view is in degrees. Other camera measurements are Three.js world units.
export const tourCamera = {
  fov: 48,
  targetLimit: 5.8,
  caseHalfWidth: 2.55,
  framingPadding: 0.85,
  signWidth: 4.7,
  signHeight: 5.3,
  baseDistance: 11.4,
  dolly: 1.35,
  orbit: 0.39,
  desktopDpr: 1.5,
  mobileDpr: 1.1,
} as const;
