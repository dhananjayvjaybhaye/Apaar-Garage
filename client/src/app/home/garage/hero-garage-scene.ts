import {
  BoxGeometry,
  Color,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Scene,
  type Material,
} from 'three';
import { heroScene } from '../hero.config';
import { heroZones } from './hero-garage-camera';
import { addHeroLighting, garageSign } from './hero-garage-lighting';
import { addRcDisplayDetails } from './hero-rc-display';
import type { GarageBay } from './garage-models';

const { colors } = heroScene;

function box(
  parent: Group | Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: Material,
) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function* createHeroGarage(scene: Scene, document: Document, compact: boolean) {
  scene.background = new Color(colors.haze);
  scene.fog = new Fog(colors.haze, 19, compact ? 82 : 62);
  addRoom(scene);
  yield;
  const animateLights = yield* addHeroLighting(scene, document, compact);
  const bays: GarageBay[] = [];
  for (const { x, sign } of heroZones) {
    bays.push(createBay(scene, document, x, sign, compact));
    yield;
  }
  const rc = heroZones.find(({ category }) => category === 'rc');
  const animatePlane = rc && addRcDisplayDetails(scene, rc.x);
  const zoneLight = compact ? makeBayLight() : undefined;
  if (zoneLight) scene.add(zoneLight);
  return {
    bays,
    animate(time: number, active: number, blend: number, immediate: boolean, signX: number) {
      animateLights(time, active, blend, immediate, signX);
      animatePlane?.(time);
      if (zoneLight) {
        const position = heroZones[active].x;
        zoneLight.position.x = immediate
          ? position
          : zoneLight.position.x + (position - zoneLight.position.x) * 0.19;
        zoneLight.intensity = bays[active].lightIntensity;
      }
    },
  };
}

function addRoom(scene: Scene) {
  const metal = new MeshStandardMaterial({ color: colors.metal, roughness: 0.65, metalness: 0.28 });
  const wall = new MeshStandardMaterial({ color: colors.wall, roughness: 0.88 });
  const floor = new Mesh(
    new PlaneGeometry(50, 44),
    new MeshStandardMaterial({
      color: colors.floor,
      roughness: 0.69,
      metalness: 0.18,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 14;
  scene.add(floor);
  box(scene, 0, 3.5, -5.6, 31, 7, 0.45, wall);
  for (const side of [-1, 1]) box(scene, side * 15.5, 3.5, 11, 0.4, 7, 32, metal);
  box(scene, 0, 7, 9, 31, 0.25, 29, metal);
  for (let x = -14; x <= 14; x += 2.1) box(scene, x, 4.8, -5.31, 0.085, 4.35, 0.18, metal);
  for (let z = -3; z <= 19; z += 4.4) box(scene, 0, 6.79, z, 31, 0.22, 0.34, wall);

  const slat = new MeshStandardMaterial({ color: colors.wall, metalness: 0.36, roughness: 0.6 });
  box(scene, 0, 2.2, -5.24, 5.65, 4.4, 0.31, metal);
  const slats = new InstancedMesh(new BoxGeometry(5.2, 0.163, 0.08), slat, 23);
  const transform = new Matrix4();
  for (let row = 0; row < slats.count; row++) {
    slats.setMatrixAt(row, transform.makeTranslation(0, 0.22 + row * 0.185, -5.06));
  }
  scene.add(slats);
  for (const x of [-2.71, 2.71]) box(scene, x, 2.18, -4.98, 0.13, 4.36, 0.16, wall);
  const strip = new MeshBasicMaterial({ color: colors.strip, toneMapped: false });
  for (const { x } of heroZones) {
    box(scene, x, 6.6, -0.35, 4.5, 0.2, 0.86, metal);
    box(scene, x, 6.48, -0.35, 4.16, 0.05, 0.35, strip);
  }
}

function makeBayLight() {
  const light = new PointLight(
    colors.warm,
    heroScene.activeLight * heroScene.inactiveBrightness,
    9,
    1.6,
  );
  light.position.set(0, 3.15, -0.54);
  return light;
}

function createBay(
  scene: Scene,
  document: Document,
  x: number,
  label: string,
  compact: boolean,
): GarageBay {
  const bay = new Group();
  bay.position.x = x;
  scene.add(bay);
  const metal = new MeshStandardMaterial({ color: colors.metal, roughness: 0.6 });
  const bench = new MeshStandardMaterial({ color: colors.bench, roughness: 0.76 });
  const rail = new MeshStandardMaterial({ color: colors.rail, emissive: colors.rail });
  const glass = new MeshBasicMaterial({
    color: colors.ambient,
    opacity: 0.07,
    transparent: true,
    depthWrite: false,
  });
  box(bay, 0, 1.02, -1.6, 4.6, 0.23, 2.55, bench);
  box(bay, 0, 0.87, -0.31, 4.6, 0.09, 0.08, metal);
  box(bay, 0, 0.91, -0.253, 4.41, 0.034, 0.025, rail);
  box(bay, 0, 0.37, -1.6, 4.46, 0.12, 2.41, metal);
  box(bay, 0, 3.42, -1.59, 4.6, 0.15, 2.53, metal);
  box(bay, 0, 3.33, -0.34, 4.38, 0.032, 0.055, rail);
  for (const side of [-2.24, 2.24]) {
    for (const depth of [-2.81, -0.38]) box(bay, side, 1.7, depth, 0.14, 3.4, 0.16, metal);
    box(bay, side, 2.27, -1.58, 0.018, 2.22, 2.3, glass);
  }
  const sign = garageSign(document, label, 2.34, 0.42, compact);
  sign.position.set(0, 3.73, -0.48);
  bay.add(sign);

  const light = compact ? undefined : makeBayLight();
  if (light) bay.add(light);
  const halo = new Mesh(
    new RingGeometry(0.97, 1.07, 32),
    new MeshBasicMaterial({
      color: colors.warm,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 1.14, -1.56);
  bay.add(halo);
  const display = new Group();
  display.position.set(0, 1.14, -1.58);
  bay.add(display);
  const hit = box(
    bay,
    0,
    2.12,
    -1.47,
    3.1,
    1.9,
    2.02,
    new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    }),
  );
  const surfaces = [metal, bench, rail].map((material) => ({
    material,
    color: material.color.clone(),
  }));
  return {
    display,
    hit,
    halo,
    light,
    rail,
    focus: 0,
    hasModel: false,
    lightIntensity: heroScene.activeLight * heroScene.inactiveBrightness,
    setFocus(focus) {
      const brightness = heroScene.inactiveBrightness + focus * (1 - heroScene.inactiveBrightness);
      for (const { material, color } of surfaces)
        material.color.copy(color).multiplyScalar(brightness);
      bay.scale.setScalar(1 + focus * (heroScene.activeScale - 1));
      sign.scale.setScalar(1 + focus * (heroScene.activeLabelScale - 1));
      sign.material.color.setScalar(brightness + focus * heroScene.activeLabelGlow);
    },
  };
}
