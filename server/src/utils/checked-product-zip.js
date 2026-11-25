import { extname } from 'node:path';
import { promisify } from 'node:util';
import yauzl from 'yauzl';
import { expandedZipMaxBytes, maxArchiveEntries } from '../config/product-import.js';
import { HttpError } from './http-error.js';

const fromBuffer = promisify(yauzl.fromBuffer);
const fileTypes = new Set(['.jpg', '.jpeg', '.png', '.webp']);
// eslint-disable-next-line no-control-regex -- Reject control characters in archive paths.
const safeBasename = /^[^/:\\\u0000-\u001f]+$/u;
const allowedWorkbookPart =
  /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core|custom)\.xml|xl\/(?:workbook|styles|sharedStrings|calcChain)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/worksheets\/sheet\d+\.xml|xl\/theme\/theme\d+\.xml)$/;
const fileKindMask = 0o170000;
const symbolicLink = 0o120000;

export function imageBasename(name) {
  return (
    safeBasename.test(name) &&
    name !== '.' &&
    name !== '..' &&
    fileTypes.has(extname(name).toLowerCase())
  );
}

export async function checkedZip(buffer, workbook, maxEntryBytes) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50)
    throw new HttpError(400, 'Choose a valid ZIP archive.');
  let archive;
  try {
    archive = await fromBuffer(buffer, {
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
    if (archive.entryCount > maxArchiveEntries)
      throw new HttpError(413, 'The ZIP contains too many entries.');
    const read = promisify(archive.openReadStream.bind(archive));
    const files = new Map();
    let total = 0;
    await new Promise((resolve, reject) => {
      archive.on('error', reject);
      archive.on('end', resolve);
      archive.on('entry', (entry) => {
        const handle = async () => {
          const name = entry.fileName;
          const parts = name.replace(/\/$/, '').split('/');
          if (
            parts.some((part) => !safeBasename.test(part) || part === '.' || part === '..') ||
            ((entry.externalFileAttributes >>> 16) & fileKindMask) === symbolicLink ||
            entry.generalPurposeBitFlag & 1
          )
            throw new HttpError(400, 'The ZIP contains unsafe paths or entries.');
          if (name.endsWith('/')) {
            if (entry.uncompressedSize)
              throw new HttpError(400, 'The ZIP contains an invalid directory.');
            return;
          }
          const key = workbook ? name : parts.at(-1).toLowerCase();
          if (
            !(workbook ? allowedWorkbookPart.test(name) : imageBasename(parts.at(-1))) ||
            files.has(key)
          )
            throw new HttpError(
              400,
              workbook
                ? 'The workbook contains unsupported parts, macros or embedded objects.'
                : 'The image ZIP must contain only JPG, PNG or WebP files with unique filenames.',
            );
          total += entry.uncompressedSize;
          if (total > expandedZipMaxBytes || entry.uncompressedSize > maxEntryBytes)
            throw new HttpError(413, 'The ZIP expands beyond the allowed size.');
          const stream = await read(entry);
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          files.set(key, Buffer.concat(chunks));
        };
        handle().then(() => archive.readEntry(), reject);
      });
      archive.readEntry();
    });
    return files;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The ZIP is invalid or contains unsafe paths or entries.');
  } finally {
    archive?.close();
  }
}
