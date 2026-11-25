import { extname } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { imageMaxPixels } from '../config/admin-panel.js';
import { HttpError } from '../utils/http-error.js';
import { writableColumns } from '../utils/product-sheet-columns.js';

const responseLimit = 256 * 1024;
const providerTimeoutMs = 20_000;
const mimeTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const hints = z.object({
  suggestions: z
    .array(
      z.object({
        field: z.string(),
        value: z.union([
          z.string().max(4000),
          z.number(),
          z.boolean(),
          z.array(z.string().max(1000)).max(50),
        ]),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(writableColumns.length),
});

export const extractionExtensions = Object.keys(mimeTypes);

async function confirmType(file, extension) {
  if (extension === '.pdf') {
    if (file.bytes.subarray(0, 5).toString() === '%PDF-') return;
  } else {
    try {
      const { format } = await sharp(file.bytes, { limitInputPixels: imageMaxPixels }).metadata();
      if (mimeTypes[extension] === 'image/' + format) return;
    } catch {
      // Return the same error for invalid and mismatched images.
    }
  }
  throw new HttpError(415, 'The document content does not match the file extension.');
}

// Providers implement extract({ name, bytes }) and return a list of suggestions.
export function configuredProductExtractor(env = process.env) {
  if (env.PRODUCT_AI_PREFILL !== 'true' || !env.PRODUCT_AI_PREFILL_URL) return null;
  const endpoint = new URL(env.PRODUCT_AI_PREFILL_URL);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password)
    throw new Error('PRODUCT_AI_PREFILL_URL must be an HTTPS URL without credentials.');
  return {
    async extract(file) {
      const extension = extname(file.name).toLowerCase();
      await confirmType(file, extension);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: file.bytes,
          redirect: 'error',
          headers: {
            'Content-Type': mimeTypes[extension],
            ...(env.PRODUCT_AI_PREFILL_TOKEN && {
              Authorization: 'Bearer ' + env.PRODUCT_AI_PREFILL_TOKEN,
            }),
          },
          signal: AbortSignal.timeout(providerTimeoutMs),
        });
        if (!response.ok || !response.body) throw new Error('Extraction failed.');
        const chunks = [];
        let bytes = 0;
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > responseLimit) throw new Error('Extraction response is too large.');
          chunks.push(chunk);
        }
        const { suggestions } = hints.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        return suggestions.filter(
          ({ field }) =>
            writableColumns.includes(field) && !['status', 'imageFiles'].includes(field),
        );
      } catch {
        throw new HttpError(502, 'The extraction service could not read the document.');
      }
    },
  };
}
