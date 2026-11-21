import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three';
import { heroScene } from '../hero.config';

// Size in world units, matching the existing photo cards in all four display cases.
const card = { width: 2.62, height: 1.94, centerY: 1.02, centerZ: 0.19 };

export function makeBenchCard(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  const face = new Mesh(
    new PlaneGeometry(card.width, card.height),
    new MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  face.position.set(0, card.centerY, card.centerZ);
  return face;
}

export function limitBenchTexture(document: Document, source: Texture, maxSize: number): Texture {
  const image: unknown = source.image;
  if (!(image instanceof HTMLImageElement)) return source;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const ratio = maxSize / Math.max(width, height);
  if (!width || !height || ratio >= 1) return source;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const brush = canvas.getContext('2d');
  if (!brush) return source;
  brush.drawImage(image, 0, 0, canvas.width, canvas.height);
  source.dispose();
  return new CanvasTexture(canvas);
}

export function rcBenchFallback(document: Document, productName?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 237;
  const brush = canvas.getContext('2d');
  if (brush) {
    const { width, height } = canvas;
    brush.fillStyle = heroScene.colors.haze;
    brush.fillRect(0, 0, width, height);
    brush.strokeStyle = heroScene.colors.rail;
    brush.lineWidth = 3;
    brush.strokeRect(9, 9, width - 18, height - 18);
    brush.fillStyle = heroScene.colors.warm;
    brush.textAlign = 'center';
    brush.textBaseline = 'middle';
    brush.font = 'bold 38px sans-serif';
    brush.fillText('RC TOYS', width / 2, height * 0.41, width - 40);
    brush.font = 'bold 18px sans-serif';
    brush.fillText(
      productName || 'No RC products to display yet',
      width / 2,
      height * 0.63,
      width - 40,
    );
  }
  return makeBenchCard(new CanvasTexture(canvas));
}
