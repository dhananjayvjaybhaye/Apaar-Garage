import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { validateBytes } from 'gltf-validator';
import sharp from 'sharp';
import { imageLongEdge, imageMaxPixels, webpQuality } from '../config/admin-panel.js';
import { HttpError } from '../utils/http-error.js';

const jsonChunk = 0x4e4f534a;
const glbMagic = 0x46546c67;
const glbVersion = 2;
const headerBytes = 20;

export async function convertProductImage(buffer) {
  try {
    const image = sharp(buffer, { limitInputPixels: imageMaxPixels, failOn: 'error' });
    const { format } = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(format)) throw new Error('Format unsupported.');
    return await image
      .rotate()
      .resize({
        width: imageLongEdge,
        height: imageLongEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: webpQuality })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      'Upload a valid JPG, PNG, or WebP image within the supported dimensions.',
    );
  }
}

function readGLB(buffer) {
  if (
    buffer.length < headerBytes ||
    buffer.readUInt32LE(0) !== glbMagic ||
    buffer.readUInt32LE(4) !== glbVersion ||
    buffer.readUInt32LE(8) !== buffer.length ||
    buffer.readUInt32LE(16) !== jsonChunk
  )
    throw new Error('Invalid GLB header.');
  const length = buffer.readUInt32LE(12);
  if (!length || length % 4 || headerBytes + length > buffer.length)
    throw new Error('Invalid GLB chunk.');
  return JSON.parse(buffer.toString('utf8', headerBytes, headerBytes + length));
}

export async function validateProductModel(buffer) {
  try {
    const model = readGLB(buffer);
    const resources = [...(model.buffers ?? []), ...(model.images ?? [])];
    if (resources.some(({ uri }) => uri != null && !uri.startsWith('data:'))) {
      throw new HttpError(400, 'Export a self-contained GLB with embedded textures and buffers.');
    }
    const { issues } = await validateBytes(buffer, {
      maxIssues: 20,
      externalResourceFunction: () =>
        Promise.reject(new Error('External resources are unsupported.')),
    });
    if (issues.numErrors || !model.meshes?.length) throw new Error('Invalid mesh or GLB data.');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Upload a valid GLB 2.0 model with at least one mesh.');
  }
  return buffer;
}

function uploadToCloud(config, bytes, type, id) {
  const raw = type === 'glb';
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          ...config,
          disable_promises: true,
          resource_type: raw ? 'raw' : 'image',
          folder: 'apaar-garage/products',
          public_id: raw ? id + '.glb' : id,
          ...(!raw && { format: 'webp' }),
          overwrite: false,
        },
        (error, result) => {
          if (error || !result?.secure_url)
            reject(new HttpError(502, 'Cloudinary could not store this upload.'));
          else resolve(result.secure_url);
        },
      )
      .end(bytes);
  });
}

export function createProductMedia({ cloud, localDirectory }) {
  const store = async (bytes, type) => {
    const id = randomUUID();
    if (cloud) {
      const url = await uploadToCloud(cloud, bytes, type, id);
      return {
        url,
        remove: () =>
          cloudinary.uploader.destroy(
            'apaar-garage/products/' + id + (type === 'glb' ? '.glb' : ''),
            { ...cloud, resource_type: type === 'glb' ? 'raw' : 'image' },
          ),
      };
    }
    if (!localDirectory)
      throw new HttpError(503, 'Configure Cloudinary before uploading media in production.');
    await mkdir(localDirectory, { recursive: true });
    const filename = id + '.' + type;
    const path = join(localDirectory, filename);
    await writeFile(path, bytes, { flag: 'wx' });
    return { url: '/api/uploads/' + filename, remove: () => unlink(path) };
  };
  return { localDirectory, store, save: async (bytes, type) => (await store(bytes, type)).url };
}
