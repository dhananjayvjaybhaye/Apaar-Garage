import { heroLayout, heroScene } from '../hero.config';
import { garageBench } from './garage-bench-layout';
import { heroCameraAt, heroZones } from './hero-garage-camera';

type Point = readonly [number, number, number];
type Face = { x: number; y: number; z: number; width: number; height: number };
type Panel = { kind: string; points: string };
type Pose = ReturnType<typeof heroCameraAt>;
const viewBoxSize = 1000;

export function skeletonProjector(pose: Pose, width: number, height: number) {
  const unit = (x: number, y: number, z: number): Point => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };
  const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const forward = unit(pose.lookX - pose.x, pose.lookY - pose.y, pose.lookZ - pose.z);
  const right = unit(-forward[2], 0, forward[0]);
  const up: Point = [
    -right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1],
  ];
  const focal = height / (2 * Math.tan((heroScene.fieldOfView * Math.PI) / 360));

  return (x: number, y: number, z: number) => {
    const relative: Point = [x - pose.x, y - pose.y, z - pose.z];
    const factor = focal / dot(relative, forward);
    return [
      (pose.screenX + (dot(relative, right) * factor) / width) * viewBoxSize,
      (pose.screenY - (dot(relative, up) * factor) / height) * viewBoxSize,
    ];
  };
}

export function garageSkeletonLayout(index: number, width: number, height: number) {
  const pose = heroCameraAt(index, width, height, width < heroLayout.stackedWidthPx);
  const project = skeletonProjector(pose, width, height);
  function panel(kind: string, { x, y, z, width, height }: Face): Panel {
    const offsets = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const points = offsets.map(([horizontal, vertical]) =>
      project(x + (horizontal * width) / 2, y + (vertical * height) / 2, z).join(','),
    );
    return { kind, points: points.join(' ') };
  }

  const { neonSign, rcPlane } = heroScene;
  const sign = panel('neon', { ...neonSign, x: pose.signX });
  const rc = heroZones.find((zone) => zone.category === 'rc')!;
  const plane = panel('plane', {
    x: rc.x + rcPlane.xOffset,
    y: rcPlane.hangerY - rcPlane.drop,
    z: rcPlane.z,
    width: rcPlane.halfWidth * 2,
    height: rcPlane.top - rcPlane.bottom,
  });

  const lights = heroZones.map(({ x }) => panel('light', { x, ...garageBench.light }));
  const { card, display } = garageBench;
  const bays = heroZones.map(({ x, category }, bayIndex) => {
    const active = bayIndex === index;
    const scale = active ? heroScene.activeScale : 1;
    const labelScale = active ? heroScene.activeLabelScale : 1;
    function face(kind: string, piece: Omit<Face, 'x'>, localX = 0, sizeScale = 1) {
      return panel(kind, {
        x: x + localX * scale,
        y: piece.y * scale,
        z: piece.z * scale,
        width: piece.width * scale * sizeScale,
        height: piece.height * scale * sizeScale,
      });
    }
    return {
      category,
      active,
      parts: [
        face('opening', { y: 2.18, z: -1.45, width: garageBench.shelves[0].width, height: 2.42 }),
        face('model', { ...card, y: display.y + card.y, z: display.z + card.z }),
        ...garageBench.shelves.map((shelf) =>
          face('frame', { ...shelf, z: shelf.z + shelf.depth / 2 }),
        ),
        face('frame', { ...garageBench.base, z: garageBench.base.z + garageBench.base.depth / 2 }),
        ...[-1, 1].map((side) => face('frame', garageBench.posts, side * garageBench.posts.x)),
        face('label', garageBench.label, 0, labelScale),
      ],
    };
  });

  return { sign, plane, lights, bays };
}
