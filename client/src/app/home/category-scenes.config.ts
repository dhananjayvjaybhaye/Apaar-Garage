export const categoryScenes = {
  productLimit: 8,
  imageSizes:
    'auto, (min-width: 98rem) 360px, (min-width: 64rem) 25vw, (min-width: 40rem) 50vw, calc(100vw - 2rem)',
  // ScrollTrigger start and end lines are percentages of the viewport. Scrub is in seconds.
  rowStart: 'top 96%',
  rowEnd: 'bottom 19%',
  mobileRowEnd: 'bottom 36%',
  headingStart: 'top 97%',
  headingEnd: 'top 67%',
  scrubSeconds: 0.28,
  // Distances are pixels, rotation is in degrees, timings are fractions of a row's scroll range.
  entry: { y: 35, z: -250, rotationX: 14, scale: 0.88 },
  mobileEntry: { y: 18, z: -48, rotationX: 4, scale: 0.97 },
  exit: { y: -14, z: 18, opacity: 0.76 },
  revealDuration: 0.44,
  rowStagger: 0.045,
  reducedFadeSeconds: 0.24,
  leaveAt: 0.79,
  rowParallaxPx: 4,
  headingTravelPercent: -101,
  headingStagger: 0.12,
  headingLineDuration: 0.66,
  headingLinkAt: 0.78,
  overlapTravelPx: 28,
  overlapDuration: 0.28,
  atmosphereTravelPx: { glow: 28, beams: 65, dust: 102 },
} as const;
