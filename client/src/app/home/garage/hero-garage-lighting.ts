import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
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
  paint: (context: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * height) / width);
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
  neon = false,
) {
  return paintedPlane(document, width, height, (brush, w, h) => {
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
      brush.shadowBlur = 30;
      brush.fillText(text, w / 2, h / 2, w * 0.83);
      brush.shadowBlur = 10;
    }
    brush.fillText(text, w / 2, h / 2, w * 0.83);
  });
}

export function addHeroLighting(scene: Scene, document: Document, compact: boolean) {
  scene.add(
    new HemisphereLight(colors.ambient, colors.floor, 1.45),
    new AmbientLight(colors.ambient, 0.4),
  );
  const sign = garageSign(document, 'APAAR GARAGE', 7.4, 1.85, true);
  sign.position.set(0, 5.38, -5.08);
  scene.add(sign);
  const cones = heroZones.map(({ x }) => {
    const reflection = paintedPlane(document, 5.9, 6, (brush, w, h) => {
      const gradient = brush.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, colors.warm + '86');
      gradient.addColorStop(0.35, colors.rail + '36');
      gradient.addColorStop(1, colors.rail + '00');
      brush.fillStyle = gradient;
      brush.fillRect(0, 0, w, h);
    });
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(x, 0.013, 1.7);
    reflection.material.opacity = 0.55;
    scene.add(reflection);
    const beam = paintedPlane(document, 6.6, 6.6, (brush, w, h) => {
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
    beam.position.set(x, 3.32, -0.35);
    beam.renderOrder = 2;
    scene.add(beam);
    return { beam, reflection };
  });

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

  return (time: number, active: number, blend: number) => {
    sign.material.opacity = 0.88 + Math.sin((time * 2 * Math.PI) / heroScene.neonCycleMs) * 0.11;
    const drift = (time * 2 * Math.PI) / heroScene.dustCycleMs;
    dust.position.set(Math.sin(drift) * 0.38, Math.sin(drift * 0.7) * 0.23, 0);
    cones.forEach(({ beam, reflection }, index) => {
      const target = (index === active ? 0.7 : 0.3) * (1 - 0.55 * blend);
      beam.material.opacity += (target - beam.material.opacity) * 0.09;
      reflection.material.opacity = beam.material.opacity;
    });
  };
}
