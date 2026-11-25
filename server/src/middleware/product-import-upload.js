import Busboy from 'busboy';
import { extname } from 'node:path';
import { imageZipMaxBytes, maxImportJobs, sheetMaxBytes } from '../config/product-import.js';
import { HttpError } from '../utils/http-error.js';

const maxProofBytes = 64 * 1024;
const multipartOverhead = 96 * 1024;
// eslint-disable-next-line no-control-regex -- Reject control characters in filenames.
const safeName = /^[^/\\:\u0000-\u001f\u007f]{1,200}$/u;
let active = 0;

export function productImportCapacity(handler) {
  return async (req, res) => {
    if (active >= maxImportJobs)
      throw new HttpError(429, 'Other imports are being checked. Try again shortly.');
    active++;
    try {
      await handler(req, res);
    } finally {
      active--;
    }
  };
}

export function readImportUpload(req, { extensions, allowZip = false }) {
  if (!req.is('multipart/form-data')) throw new HttpError(415, 'Choose a file to upload.');
  const sizeLimit = sheetMaxBytes + (allowZip ? imageZipMaxBytes : 0) + multipartOverhead;
  if (Number(req.get('content-length')) > sizeLimit)
    throw new HttpError(413, 'The upload is too large.');

  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        preservePath: true,
        defParamCharset: 'utf8',
        limits: {
          files: allowZip ? 2 : 1,
          fields: allowZip ? 2 : 0,
          parts: allowZip ? 5 : 2,
          fileSize: allowZip ? imageZipMaxBytes + 1 : sheetMaxBytes + 1,
          fieldSize: maxProofBytes,
        },
      });
    } catch {
      reject(new HttpError(400, 'The upload could not be read.'));
      return;
    }

    const files = {},
      fields = {};
    let failure,
      received = 0;
    const remember = (status, message) => {
      failure ??= new HttpError(status, message);
    };
    const stop = () => {
      req.unpipe(parser);
      parser.destroy();
      req.resume();
      reject(new HttpError(413, 'The upload is too large.'));
    };
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > sizeLimit && !parser.destroyed) stop();
    });
    req.once('aborted', () => parser.destroy(new Error('Upload interrupted.')));
    parser.on('field', (key, value, { valueTruncated, nameTruncated }) => {
      if (
        valueTruncated ||
        nameTruncated ||
        !['mode', 'proof'].includes(key) ||
        Object.hasOwn(fields, key)
      )
        remember(400, 'The upload contains invalid import options.');
      else fields[key] = value;
    });
    parser.on('file', (key, stream, { filename }) => {
      const zip = key === 'images' && allowZip;
      const allowed = zip ? ['.zip'] : extensions;
      if (
        (key !== 'sheet' && !zip) ||
        Object.hasOwn(files, key) ||
        !safeName.test(filename ?? '') ||
        !allowed.includes(extname(filename ?? '').toLowerCase())
      ) {
        remember(415, 'The upload contains an unsupported filename or extension.');
        stream.resume();
        return;
      }
      const limit = zip ? imageZipMaxBytes : sheetMaxBytes;
      const chunks = [];
      let bytes = 0;
      files[key] = { name: filename };
      stream.on('limit', () => remember(413, 'One of the uploaded files is too large.'));
      stream.on('error', () => remember(400, 'One of the uploaded files could not be read.'));
      stream.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > limit) remember(413, 'One of the uploaded files is too large.');
        if (!failure) chunks.push(chunk);
      });
      stream.on('end', () => {
        if (!failure) files[key].bytes = Buffer.concat(chunks);
      });
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit'])
      parser.on(event, () => remember(400, 'The upload has too many files or options.'));
    parser.on('error', () => reject(new HttpError(400, 'The upload was incomplete or invalid.')));
    parser.on('close', () => {
      if (failure) reject(failure);
      else if (!files.sheet?.bytes?.length || (files.images && !files.images.bytes?.length))
        reject(new HttpError(400, 'Choose a nonempty file to upload.'));
      else resolve({ ...files, ...fields });
    });
    req.pipe(parser);
  });
}
