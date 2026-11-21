import { ambientConfig } from './ambient.config';

// A stable sequence keeps the same shapes in place when the viewport changes size.
export function createAmbientShapes() {
  let state = 4291;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const between = ([min, max]: readonly [number, number]) => min + (max - min) * random();
  return Array.from({ length: ambientConfig.fullCount }, (_, index) => {
    const type = ambientConfig.shapeTypes[index % ambientConfig.shapeTypes.length];
    const color = ambientConfig.palette[Math.floor(random() * ambientConfig.palette.length)];
    const dust = type === 'dust';
    const size = dust ? between([2, 4]) : between(ambientConfig.shapeSize);
    const duration = between(ambientConfig.driftDuration);
    return {
      type,
      filled: index % 3 === 1,
      bokeh: index % 5 === 2 && !dust,
      style: {
        '--shape-x': between([3, 97]) + '%',
        '--shape-y': between([2, 98]) + '%',
        '--shape-size': size + 'px',
        '--shape-color': color,
        '--shape-opacity': between(ambientConfig.shapeOpacity),
        '--shape-depth': between(ambientConfig.depth),
        '--shape-float': between(ambientConfig.driftDistance) + 'px',
        '--shape-turn':
          between([-ambientConfig.driftRotation, ambientConfig.driftRotation]) + 'deg',
        '--shape-duration': duration + 's',
        '--shape-delay': -duration * random() + 's',
      },
    };
  });
}
