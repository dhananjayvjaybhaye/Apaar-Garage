import { PerspectiveCamera, Vector3 } from 'three';
import { heroScene } from '../hero.config';
import { heroCameraAt } from './hero-garage-camera';
import { garageSkeletonLayout, skeletonProjector } from './garage-skeleton-layout';

describe('garage loading geometry', () => {
  it.each([
    [1440, 825, false],
    [1920, 1005, false],
    [390, 620, true],
  ] as const)('matches the 3D camera projection at %i by %i', (width, height, compact) => {
    for (const zone of [0, 1, 2, 3]) {
      const pose = heroCameraAt(zone, width, height, compact);
      const camera = new PerspectiveCamera(heroScene.fieldOfView, width / height, 0.1, 85);
      camera.setViewOffset(
        width,
        height,
        width * (0.5 - pose.screenX),
        height * (0.5 - pose.screenY),
        width,
        height,
      );
      camera.position.set(pose.x, pose.y, pose.z);
      camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
      camera.updateMatrixWorld();
      const project = skeletonProjector(pose, width, height);
      for (const world of [
        [pose.signX, heroScene.neonSign.y, heroScene.neonSign.z],
        [pose.lookX - 2.3, 0, -0.38],
        [pose.lookX + 2.3, 3.42, -0.31],
      ] as const) {
        const expected = new Vector3(...world).project(camera);
        const [x, y] = project(world[0], world[1], world[2]);
        expect(x).toBeCloseTo((1 + expected.x) * 500, 6);
        expect(y).toBeCloseTo((1 - expected.y) * 500, 6);
      }
      const layout = garageSkeletonLayout(zone, width, height);
      expect(layout.bays).toHaveLength(4);
      expect(layout.bays.findIndex((bay) => bay.active)).toBe(zone);
    }
  });
});
