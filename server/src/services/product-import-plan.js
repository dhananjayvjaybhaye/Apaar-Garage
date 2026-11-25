import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { skuPattern } from '../utils/product-compliance.js';
import { productSheetValues } from '../utils/product-sheet-values.js';
import { parseProductSheet } from '../utils/product-sheet.js';
import { Product } from '../models/product.js';
import { ProductImportRow } from '../models/product-import-row.js';
import { validateProduct } from './admin-products.js';
import { prepareRowImages, readProductImages, resolveImages } from './product-import-images.js';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const productRevision = (product) => digest(JSON.stringify(product));

function repeats(values) {
  const seen = new Set(),
    duplicate = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return duplicate;
}

function withMedia(input, previous, names) {
  if (!names.length && !Object.hasOwn(input, 'images')) return {};
  return {
    images: [
      ...(input.images ?? []),
      ...names.map((_, index) => '/api/uploads/import-preview-' + index + '.webp'),
    ],
    imageAlts:
      input.imageAlts ??
      (names.length || !isDeepStrictEqual(previous?.images, input.images)
        ? undefined
        : previous?.imageAlts),
  };
}

export async function planImport(sheet, zip, mode) {
  const batch = digest(digest(sheet.bytes) + (zip ? digest(zip.bytes) : ''));
  const rows = (await parseProductSheet(sheet)).map(productSheetValues);
  const images = await readProductImages(zip);
  const skus = rows.map(({ values }) => values.sku).filter(Boolean);
  const slugs = rows.map(({ values }) => values.slug).filter(Boolean);
  const rowsWithIds = rows.map((row) => ({ ...row, receipt: batch + ':' + row.number }));
  const [products, applied] = await Promise.all([
    Product.find({ $or: [{ sku: { $in: skus } }, { slug: { $in: slugs } }] })
      .select('+costPrice')
      .lean(),
    ProductImportRow.find({ _id: { $in: rowsWithIds.map(({ receipt }) => receipt) } }).distinct(
      '_id',
    ),
  ]);
  const state = {
    skus: new Map(products.map((product) => [product.sku, product])),
    slugs: new Map(products.map((product) => [product.slug, product])),
    repeatedSkus: repeats(skus),
    repeatedSlugs: repeats(slugs),
    applied: new Set(applied),
    images,
    checkedImages: new Map(),
    mode,
  };
  const results = [];
  for (const row of rowsWithIds) results.push(await planRow(row, state));
  return { batch, rows: results, images };
}

async function planRow(row, state) {
  const { imageFiles: _imageFiles, ...input } = row.values;
  const { sku, slug } = input;
  const existing = state.skus.get(sku);
  const display = {
    number: row.number,
    sku,
    name: input.name ?? existing?.name,
    receipt: row.receipt,
  };
  if (state.applied.has(row.receipt)) return { ...display, status: 'unchanged', errors: [] };
  const errors = [...row.errors];
  if (!sku || !skuPattern.test(sku))
    errors.push({ field: 'sku', message: 'Enter a valid SKU to import this product.' });
  if (state.repeatedSkus.has(sku))
    errors.push({ field: 'sku', message: 'This SKU occurs more than once in the sheet.' });
  if (state.repeatedSlugs.has(slug))
    errors.push({ field: 'slug', message: 'This slug occurs more than once in the sheet.' });
  if (existing && slug && existing.slug !== slug)
    errors.push({ field: 'slug', message: 'An existing product’s slug cannot be changed.' });
  if (state.slugs.has(slug) && state.slugs.get(slug) !== existing)
    errors.push({ field: 'slug', message: 'That slug belongs to a different SKU.' });
  const names = resolveImages({ ...row.values, slug: slug ?? existing?.slug }, state.images);
  errors.push(...(await prepareRowImages(names, state.images, state.checkedImages)));
  const candidate = {
    ...existing,
    ...input,
    ...withMedia(input, existing, names),
    status: 'draft',
  };
  candidate.stock ??= 0;
  if (input.dimensionsMm)
    candidate.dimensionsMm = { ...existing?.dimensionsMm, ...input.dimensionsMm };
  let values;
  try {
    values = validateProduct(candidate);
  } catch (error) {
    if (!Array.isArray(error.details)) throw error;
    for (const issue of error.details)
      if (!errors.some(({ field }) => field === issue.field)) errors.push(issue);
  }
  const unchanged =
    existing &&
    values &&
    !names.length &&
    Object.entries(values).every(
      ([key, value]) => key === 'status' || isDeepStrictEqual(value, existing[key]),
    );
  if (existing && state.mode === 'create' && !unchanged)
    errors.push({
      field: 'sku',
      message: 'This SKU already exists. Choose the create and update mode to change it.',
    });
  return {
    ...display,
    status: errors.length ? 'error' : unchanged ? 'unchanged' : existing ? 'update' : 'create',
    errors,
    values,
    names,
    clearAlt:
      Object.hasOwn(candidate, 'imageAlts') &&
      candidate.imageAlts === undefined &&
      (names.length || Object.hasOwn(input, 'images')),
    revision: existing ? productRevision(existing) : '',
  };
}

export const publicRows = (rows) =>
  rows.map(({ number, sku, name, status, errors }) => ({ number, sku, name, status, errors }));

export function importCounts(rows) {
  const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const { status } of rows) counts[status]++;
  return counts;
}
