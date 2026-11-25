import { booleanFields, lists, numericFields, writableColumns } from './product-sheet-columns.js';
import { imageBasename } from './checked-product-zip.js';

const realNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const publicUrl = (value) => {
  // eslint-disable-next-line no-control-regex -- Reject control characters in local URLs.
  if (/^\/(?!\/)[^\\\x00-\x20]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

function listValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  if (!value.startsWith('[')) return value.split(/\r?\n/).map((part) => part.trim());
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseValue(key, value, invalid) {
  if (lists.has(key)) {
    const items = listValue(value);
    if (!Array.isArray(items) || items.some((part) => typeof part !== 'string'))
      return invalid('Use a JSON list of text values, or one value per line.');
    const content = items.map((part) => part.trim());
    content.forEach((part, index) => {
      if (key === 'images' && !publicUrl(part))
        invalid('Use an HTTP(S) image URL or a path beginning with /.', key + '.' + index);
      if (key === 'imageFiles' && !imageBasename(part))
        invalid('Enter a JPG, PNG or WebP filename without directories.', key + '.' + index);
    });
    return content;
  }
  if (numericFields.has(key)) {
    if (realNumber.test(String(value)) && Number.isFinite(Number(value))) return Number(value);
    return invalid('Enter a number without units or currency symbols.');
  }
  if (booleanFields.has(key)) {
    if (/^(true|false)$/i.test(String(value))) return String(value).toLowerCase() === 'true';
    return invalid('Enter TRUE or FALSE.');
  }
  if (typeof value !== 'string' && typeof value !== 'number') return invalid('Enter text.');
  const text = String(value);
  if (key === 'glbUrl' && !publicUrl(text))
    return invalid('Use an HTTP(S) model URL or a path beginning with /.');
  return key === 'sku' ? text.toUpperCase() : text;
}

export function productSheetValues(record) {
  const values = {};
  const errors = [...record.errors];
  for (const key of writableColumns) {
    if (key === 'status' || !Object.hasOwn(record.data, key)) continue;
    const raw = record.data[key];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value == null || value === '') continue;
    const parsed = parseValue(key, value, (message, field = key) => {
      errors.push({ field, message });
    });
    if (parsed === undefined) continue;
    if (key.startsWith('dimensionsMm.')) {
      values.dimensionsMm ??= {};
      values.dimensionsMm[key.split('.')[1]] = parsed;
    } else values[key] = parsed;
  }
  return { number: record.number, values, errors };
}
