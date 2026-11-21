import { tourCamera } from '../garage-tour.config';
import { cameraAt, zones } from './garage-path';

export function tourCameraAt(progress: number, aspect: number) {
  const base = cameraAt(progress);
  const { fov, targetLimit, caseHalfWidth, framingPadding, baseDistance, dolly, orbit } =
    tourCamera;
  const lookX = Math.max(-targetLimit, Math.min(targetLimit, base.lookX));
  const [first, second] = zones.map(({ x }) => Math.abs(x - lookX)).sort((a, b) => a - b);
  const horizontalSlope = Math.tan((fov * Math.PI) / 360) * aspect;
  // Leave room for two complete bays and for the small orbit and pointer offsets.
  const fit = (Math.max(first, second) + caseHalfWidth + framingPadding) / horizontalSlope;
  const pulse = Math.sin(Math.PI * progress);
  return {
    x: lookX + Math.sin(progress * Math.PI * 4) * orbit,
    y: 3.6 + pulse * 0.22,
    z: Math.max(baseDistance, fit + 0.4) + pulse * dolly,
    lookX,
    lookY: 2.65,
  };
}
