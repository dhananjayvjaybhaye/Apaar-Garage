import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Scene,
} from 'three';
import { heroScene } from '../hero.config';

export function addRcDisplayDetails(scene: Scene, x: number) {
  const hanger = new Group();
  const { xOffset, hangerY, z, drop } = heroScene.rcPlane;
  hanger.position.set(x + xOffset, hangerY, z);
  scene.add(hanger);
  const fuselage = new MeshStandardMaterial({ color: heroScene.colors.strip, roughness: 0.48 });
  const accent = new MeshStandardMaterial({ color: heroScene.colors.rail, roughness: 0.52 });
  const wire = new MeshBasicMaterial({
    color: heroScene.colors.ambient,
    transparent: true,
    opacity: 0.48,
  });

  // The pivot is at the ceiling so the plane and its suspension wires move together.
  const plane = new Group();
  plane.position.y = -drop;
  plane.rotation.y = -0.48;
  hanger.add(plane);
  const body = new Mesh(new CapsuleGeometry(0.115, 0.94, 4, 8), fuselage);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  const wing = new Mesh(new BoxGeometry(2.28, 0.06, 0.46), accent);
  wing.position.z = 0.05;
  plane.add(wing);
  const tail = new Mesh(new BoxGeometry(0.69, 0.055, 0.24), fuselage);
  tail.position.z = -0.46;
  plane.add(tail);
  const rudder = new Mesh(new BoxGeometry(0.065, 0.27, 0.22), accent);
  rudder.position.set(0, 0.115, -0.45);
  plane.add(rudder);
  for (const side of [-1, 1]) {
    const cable = new Mesh(new BoxGeometry(0.009, 1.36, 0.009), wire);
    cable.position.set(side * 0.66, 0.72, 0.05);
    plane.add(cable);
  }

  addCheckeredStrip(scene, x);
  return (time: number) => {
    const phase = (time * 2 * Math.PI) / heroScene.planeSwayCycleMs;
    hanger.rotation.z = Math.sin(phase) * heroScene.planeSwayRadians;
  };
}

function addCheckeredStrip(scene: Scene, x: number) {
  const columns = 12;
  const tileSize = 0.2;
  const tiles = new InstancedMesh(
    new BoxGeometry(tileSize, 0.01, tileSize),
    new MeshBasicMaterial({ color: '#ffffff' }),
    columns * 2,
  );
  const matrix = new Matrix4();
  for (let index = 0; index < tiles.count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    tiles.setMatrixAt(
      index,
      matrix.makeTranslation(
        x + (column - (columns - 1) / 2) * tileSize,
        0.018,
        1.1 + row * tileSize,
      ),
    );
    tiles.setColorAt(index, new Color((column + row) % 2 ? '#292a2d' : '#baa995'));
  }
  scene.add(tiles);
}
