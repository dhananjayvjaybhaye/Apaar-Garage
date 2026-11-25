import { extname } from 'node:path';
import sharp from 'sharp';
import { imageMaxBytes, imageMaxPixels } from '../config/admin-panel.js';
import { HttpError } from '../utils/http-error.js';
import { checkedZip } from '../utils/checked-product-zip.js';
import { convertProductImage } from './product-media.js';

const extensionFormats = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };

export async function readProductImages(file) {
  if (!file) return new Map();
  if (extname(file.name).toLowerCase() !== '.zip')
    throw new HttpError(415, 'Choose a ZIP of images.');
  return checkedZip(file.bytes, false, imageMaxBytes);
}

export function resolveImages(values, images) {
  const names = values.imageFiles?.map((name) => name.toLowerCase());
  if (names) return [...new Set(names)];
  const matches = [values.sku, values.slug].filter(Boolean).map((part) => part.toLowerCase());
  return [...images.keys()]
    .filter((name) => {
      const stem = name.slice(0, -extname(name).length);
      return matches.includes(stem);
    })
    .sort();
}

export async function prepareRowImages(names, files, memo) {
  const errors = [];
  for (const name of names) {
    const bytes = files.get(name);
    if (!bytes) {
      errors.push({ field: 'imageFiles', message: 'ZIP image is missing: ' + name });
      continue;
    }
    if (!memo.has(name)) memo.set(name, await checkImage(name, bytes));
    const message = memo.get(name);
    if (message) errors.push({ field: 'imageFiles', message: name + ': ' + message });
  }
  return errors;
}

async function checkImage(name, bytes) {
  try {
    const { format } = await sharp(bytes, {
      limitInputPixels: imageMaxPixels,
      failOn: 'error',
    }).metadata();
    if (format !== extensionFormats[extname(name)])
      return 'File extension does not match image content.';
    await convertProductImage(bytes);
    return '';
  } catch {
    return 'Invalid or oversized image.';
  }
}
