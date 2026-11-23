import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Scene,
} from 'three';
import { heroScene } from '../hero.config';
import { heroZones } from './hero-garage-camera';

const { colors } = heroScene;

function paintedPlane(
  document: Document,
  width: number,
  height: number,
  compact: boolean,
  paint: (context: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = compact ? heroScene.mobileTextureWidth : heroScene.desktopTextureWidth;
  canvas.height = Math.round((canvas.width * height) / width);
  const context = canvas.getContext('2d');
  if (context) paint(context, canvas.width, canvas.height);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}

export function garageSign(
  document: Document,
  text: string,
  width: number,
  height: number,
  compact: boolean,
  neon = false,
) {
  return paintedPlane(document, width, height, compact, (brush, w, h) => {
    if (!neon) {
      brush.fillStyle = colors.metal;
      brush.fillRect(0, 0, w, h);
    }
    brush.textAlign = 'center';
    brush.textBaseline = 'middle';
    brush.font = 'bold ' + Math.round(h * (neon ? 0.52 : 0.75)) + 'px "Oswald", sans-serif';
    brush.fillStyle = neon ? colors.neonFace : colors.warm;
    if (neon) {
      brush.shadowColor = colors.neon;
      brush.shadowBlur = compact ? 15 : 30;
      brush.fillText(text, w / 2, h / 2, w * 0.83);
      brush.shadowBlur = compact ? 5 : 10;
    } else {
      brush.shadowColor = colors.warm;
      brush.shadowBlur = h * 0.11;
    }
    brush.fillText(text, w / 2, h / 2, w * 0.83);
  });
}

export function* addHeroLighting(scene: Scene, document: Document, compact: boolean) {
  const hemisphere = new HemisphereLight(colors.ambient, colors.floor, 1.45);
  if (compact) {
    // Combine ambient and hemisphere fill without changing the sky or floor light contribution.
    hemisphere.groundColor.lerp(new Color(colors.ambient), 0.4 / 1.85);
    hemisphere.intensity = 1.85;
  } else scene.add(new AmbientLight(colors.ambient, 0.4));
  scene.add(hemisphere);
  const { width, height, y, z } = heroScene.neonSign;
  const sign = garageSign(document, 'APAAR GARAGE', width, height, compact, true);
  sign.position.set(0, y, z);
  scene.add(sign);
  yield;
  const sharedReflection = paintedPlane(document, 5.9, 6, compact, (brush, w, h) => {
    const gradient = brush.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, colors.warm + '86');
    gradient.addColorStop(0.35, colors.rail + '36');
    gradient.addColorStop(1, colors.rail + '00');
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, w, h);
  });
  const sharedBeam = paintedPlane(document, 6.6, 6.6, compact, (brush, w, h) => {
    const glow = brush.createLinearGradient(0, 0, 0, h);
    glow.addColorStop(0, colors.strip + '42');
    glow.addColorStop(0.5, colors.warm + '20');
    glow.addColorStop(1, colors.warm + '00');
    brush.fillStyle = glow;
    brush.beginPath();
    brush.moveTo(w * 0.45, 0);
    brush.lineTo(w * 0.55, 0);
    brush.lineTo(w, h);
    brush.lineTo(0, h);
    brush.fill();
  });
  const cones = heroZones.map(({ x }, index) => {
    // The maps and geometry are shared. Each bay still animates its own material opacity.
    const reflection = index ? sharedReflection.clone() : sharedReflection;
    const beam = index ? sharedBeam.clone() : sharedBeam;
    if (index) {
      reflection.material = sharedReflection.material.clone();
      beam.material = sharedBeam.material.clone();
    }
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(x, 0.013, 1.7);
    reflection.material.opacity = 0.55;
    scene.add(reflection);
    beam.position.set(x, 3.32, -0.35);
    beam.renderOrder = 2;
    scene.add(beam);
    return { beam, reflection };
  });
  yield;

  const count = compact ? heroScene.mobileDustCount : heroScene.dustCount;
  const points = Array.from({ length: count }, (_, index) => [
    Math.sin(index * 15.37) * 10,
    0.9 + ((index * 1.41) % 5.5),
    ((index * 2.12) % 8) - 3,
  ]).flat();
  const geometry = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(points, 3),
  );
  const dust = new Points(
    geometry,
    new PointsMaterial({
      color: colors.warm,
      transparent: true,
      opacity: 0.44,
      size: 0.028,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  return (time: number, active: number, blend: number, immediate: boolean, signX: number) => {
    sign.position.x = signX;
    sign.material.opacity = 0.88 + Math.sin((time * 2 * Math.PI) / heroScene.neonCycleMs) * 0.11;
    const drift = (time * 2 * Math.PI) / heroScene.dustCycleMs;
    dust.position.set(Math.sin(drift) * 0.38, Math.sin(drift * 0.7) * 0.23, 0);
    cones.forEach(({ beam, reflection }, index) => {
      const target = (index === active ? 0.7 : 0.3) * (1 - 0.55 * blend);
      beam.material.opacity = immediate
        ? target
        : beam.material.opacity + (target - beam.material.opacity) * 0.09;
      reflection.material.opacity = beam.material.opacity;
    });
  };
}
