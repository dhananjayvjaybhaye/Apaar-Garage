// Edit the shared ambient palette and motion speeds here.
export const ambientConfig = {
  palette: ['#f2b16c', '#e53933', '#ffd482', '#49bcb1', '#ad85dd'],
  shapeTypes: ['case', 'ring', 'gear', 'nut', 'dot', 'dust'],
  fullCount: 26,
  lightCount: 10,
  shapeSize: [12, 140], // px, except fine dust points
  shapeOpacity: [0.08, 0.3],
  driftDuration: [20, 40], // seconds per loop
  driftDistance: [14, 46], // px
  driftRotation: 40, // degrees in either direction
  depth: [0.25, 1],
  mouseTravel: 42, // px at maximum depth
  scrollTravel: 120, // px from top to bottom of the page
  lightScrollFactor: 0.35,
  cornerTravel: 10, // percentage of glow size across a page
  cornerOpacity: 0.32,
  calmOpacity: 0.11,
  glowDuration: 220, // ms for the glow to catch up while scrolling
} as const;

export const ambientStyles = {
  '--ambient-red': ambientConfig.palette[1],
  '--ambient-gold': ambientConfig.palette[2],
  '--ambient-purple': ambientConfig.palette[4],
  '--ambient-glow-time': ambientConfig.glowDuration + 'ms',
};
