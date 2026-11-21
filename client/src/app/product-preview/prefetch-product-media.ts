import { prefetchModel } from '../car-viewer/model-prefetch';
import type { Product } from '../catalog/product';
import { show3dPreviews } from '../storefront-options';
import { responsiveImage } from '../ui/responsive-image';

export const previewImageSizes = '(max-width: 48rem) 100vw, (max-width: 64rem) 48vw, 470px';
const images = new Map<string, HTMLImageElement>();

export function prefetchProductMedia(product: Product) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const image = product.images[0];
  if (image && !images.has(image)) {
    const prefetch = new Image();
    prefetch.fetchPriority = 'low';
    prefetch.sizes = previewImageSizes;
    prefetch.srcset = responsiveImage(image) ?? '';
    prefetch.src = image;
    if (images.size >= 6) images.delete(images.keys().next().value!);
    images.set(image, prefetch);
  }
  if (show3dPreviews && product.glbUrl) prefetchModel(product.glbUrl);
}
