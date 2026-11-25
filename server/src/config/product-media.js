import { fileURLToPath } from 'node:url';

export function readProductMedia(env) {
  const cloud_name = env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = env.CLOUDINARY_API_KEY?.trim();
  const api_secret = env.CLOUDINARY_API_SECRET?.trim();
  const configured = [cloud_name, api_key, api_secret].filter(Boolean).length;
  if (configured && configured !== 3)
    throw new Error('Set all three Cloudinary credentials for product uploads.');
  const local = !configured && [undefined, '', 'development', 'test'].includes(env.NODE_ENV);
  return {
    cloud: configured ? { cloud_name, api_key, api_secret, secure: true } : null,
    localDirectory: local ? fileURLToPath(new URL('../../uploads/', import.meta.url)) : null,
  };
}
