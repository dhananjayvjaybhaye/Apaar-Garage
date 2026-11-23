import { PerspectiveCamera, Vector3 } from 'three';
import { heroScene, signTopMargin } from '../hero.config';
import { heroCameraAt, heroZones } from './hero-garage-camera';

function projection(width: number, height: number, pose: ReturnType<typeof heroCameraAt>) {
  const camera = new PerspectiveCamera(heroScene.fieldOfView, width / height, 0.1, 85);
  const { x, y, z, lookX, lookY, lookZ, screenX, screenY } = pose;
  camera.setViewOffset(
    width,
    height,
    width * (0.5 - screenX),
    height * (0.5 - screenY),
    width,
    height,
  );
  camera.position.set(x, y, z);
  camera.lookAt(lookX, lookY, lookZ);
  camera.updateMatrixWorld();

  return (xs: number[], ys: number[], zs: number[]) => {
    const projected = xs.flatMap((x) =>
      ys.flatMap((y) =>
        zs.map((z) => {
          const p = new Vector3(x, y, z).project(camera);
          return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
        }),
      ),
    );
    return {
      left: Math.min(...projected.map(({ x }) => x)),
      right: Math.max(...projected.map(({ x }) => x)),
      top: Math.min(...projected.map(({ y }) => y)),
      bottom: Math.max(...projected.map(({ y }) => y)),
    };
  };
}

describe('garage hero camera', () => {
  it('starts at Cars and each dolly ends at the exact configured target', () => {
    expect(heroZones[0].category).toBe('car');
    expect(heroZones.at(-1)?.category).toBe('rc');
    for (let index = 0; index < heroZones.length; index++) {
      const target = heroCameraAt(index, 1440, 825, false);
      expect(target.lookX).toBe(heroZones[index].x);
      expect(heroCameraAt(index, 1440, 825, false, (index + 1) % heroZones.length, 1)).toEqual(
        target,
      );
    }
  });

  it.each([
    // Desktop canvas heights leave 75 CSS pixels for the sticky site header.
    [1366, 768 - 75, false],
    [1440, 900 - 75, false],
    [1920, 1080 - 75, false],
    [2560, 1440 - 75, false],
    [1024, 660, false],
    [768, 860, true],
    [390, 610, true],
  ])(
    'frames all case labels, the neon sign and the RC plane at %s × %s',
    (width, height, compact) => {
      const sign = heroScene.neonSign;
      for (const [index, { x, category }] of heroZones.entries()) {
        const pose = heroCameraAt(index, width, height, compact);
        const bounds = projection(width, height, pose);
        const bench = bounds([x - 2.4, x + 2.4], [0, 4.16], [-2.9, -0.24]);
        const neon = bounds(
          [pose.signX - sign.width / 2, pose.signX + sign.width / 2],
          [sign.y - sign.height / 2, sign.y + sign.height / 2],
          [sign.z],
        );
        const label = bounds([x - 1.52, x + 1.52], [4.16], [-0.5]);
        const screenMargin = width * 0.03;
        expect(bench.left).toBeGreaterThan(screenMargin);
        expect(bench.right).toBeLessThan(width - screenMargin);
        expect(bench.bottom).toBeLessThan(height - screenMargin);
        expect(neon.top).toBeGreaterThanOrEqual(signTopMargin);
        expect(neon.left).toBeGreaterThan(screenMargin);
        expect(neon.right).toBeLessThan(width - screenMargin);
        expect(neon.bottom).toBeLessThan(label.top);
        if (!compact && width >= 1366) {
          const fill = (bench.right - bench.left) / (width * heroScene.desktopFrame.openingWidth);
          expect(fill).toBeGreaterThanOrEqual(0.45);
          expect(fill).toBeLessThanOrEqual(0.55);
          expect(bench.left).toBeGreaterThan(width * 0.4);
        }
        if (category === 'rc') {
          const { xOffset, halfWidth, top, bottom, front, back } = heroScene.rcPlane;
          const plane = bounds(
            [x + xOffset - halfWidth, x + xOffset + halfWidth],
            [bottom, top],
            [front, back],
          );
          expect(plane.top).toBeGreaterThan(0);
          expect(plane.bottom).toBeLessThan(label.top);
          expect(plane.left).toBeGreaterThan(screenMargin);
          expect(plane.right).toBeLessThan(width - screenMargin);
          if (!compact && width >= 1366) expect(neon.right).toBeLessThan(plane.left);
        }
      }
    },
  );
});
