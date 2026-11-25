import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { historyPageSize, importModes } from '../config/product-import.js';
import { productImportCapacity, readImportUpload } from '../middleware/product-import-upload.js';
import { AuditLog } from '../models/admin-security.js';
import { Product } from '../models/product.js';
import { adminAudit, recordAudit } from '../services/audit.js';
import { draftProductIssues, productChecklist } from '../services/admin-product-actions.js';
import {
  applyImport,
  signImportPreview,
  verifyImportPreview,
} from '../services/product-import-apply.js';
import { digest, importCounts, planImport, publicRows } from '../services/product-import-plan.js';
import { extractionExtensions } from '../services/product-extraction.js';
import { HttpError } from '../utils/http-error.js';
import { parsePrefill, productRecords, sheetStream } from '../utils/product-sheet.js';
import { productSheetValues } from '../utils/product-sheet-values.js';

const base = {
  brand: 'Example Brand',
  price: 999,
  stock: 0,
  status: 'draft',
  description: 'Sample description. Replace this row before importing.',
  images: ['/images/share-garage.jpg'],
};
const examples = [
  {
    ...base,
    sku: 'EXAMPLE-DIECAST',
    slug: 'example-diecast',
    name: 'Example diecast coupe',
    productType: 'diecast',
    category: 'car',
    scale: '1:64',
  },
  {
    ...base,
    sku: 'EXAMPLE-RC',
    slug: 'example-rc',
    name: 'Example RC truck',
    productType: 'rc',
    category: 'rc-truck',
    batteryIncluded: false,
    skillLevel: 'beginner',
    recommendedAge: 14,
    warrantyDays: 30,
    readyToRun: false,
    boxContents: ['Truck', 'Remote'],
  },
];
const extensions = ['.csv', '.xlsx'];
const contentType = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const action = 'product_import.applied';

function download(template) {
  return async (req, res) => {
    const format = req.query.format ?? 'csv';
    if (typeof format !== 'string' || !Object.hasOwn(contentType, format))
      throw new HttpError(400, 'Choose CSV or XLSX.');
    const includeCost = template || req.query.includeCost === 'true';
    const cursor = template
      ? examples
      : Product.find()
          .sort({ sku: 1, slug: 1 })
          .select(includeCost ? '+costPrice' : '-costPrice')
          .lean()
          .cursor();
    const name = template ? 'product-template' : 'products';
    res.set('Content-Type', contentType[format]);
    res.attachment(name + '.' + format);
    res.set('Content-Type', contentType[format]);
    try {
      await pipeline(sheetStream(format, productRecords(cursor, includeCost)), res);
    } finally {
      if (!template) await cursor.close();
    }
  };
}

async function failedCsv(rows) {
  const records = [['row', 'sku', 'name', 'field', 'reason']];
  for (const row of rows)
    if (row.status === 'error')
      for (const { field, message } of row.errors)
        records.push([row.number, row.sku, row.name, field, message]);
  return (await sheetStream('csv', records).toArray()).join('');
}

async function prefill(req, res) {
  const { sheet } = await readImportUpload(req, { extensions: [...extensions, '.json'] });
  const [record, extra] = await parsePrefill(sheet);
  if (!record || extra) throw new HttpError(400, 'Use a file containing exactly one product row.');
  const { values, errors } = productSheetValues(record);
  delete values.imageFiles;
  const draft = { ...values, status: 'draft' };
  const candidate = {
    productType: 'diecast',
    category: draft.productType === 'rc' ? 'rc-car' : 'car',
    stock: 0,
    batteryIncluded: false,
    readyToRun: false,
    ...draft,
  };
  res.json({
    values: draft,
    issues: [...errors, ...draftProductIssues(candidate)],
    publishing: productChecklist(candidate),
  });
}

function importHandler({ media, secret }, apply) {
  return async (req, res) => {
    const { sheet, images, mode, proof } = await readImportUpload(req, {
      extensions,
      allowZip: true,
    });
    if (!importModes.includes(mode)) throw new HttpError(400, 'Choose an import mode.');
    const audit = adminAudit(req, res);
    const batch = digest(digest(sheet.bytes) + (images ? digest(images.bytes) : ''));
    const approved = apply ? verifyImportPreview(secret, proof, batch, mode, audit.who) : null;
    const plan = await planImport(sheet, images, mode);
    if (!plan.rows.length) throw new HttpError(400, 'The file contains no product rows.');
    const rows = approved ? await applyImport(plan, approved, media, audit) : plan.rows;
    const counts = importCounts(rows);
    if (approved) {
      await recordAudit(action, { ...audit, target: sheet.name, after: { mode, counts } });
      res.json({ rows: publicRows(rows), counts, failedCsv: await failedCsv(rows) });
    } else {
      res.json({
        rows: publicRows(rows),
        counts,
        failedCsv: await failedCsv(rows),
        proof: signImportPreview(secret, plan, mode, audit.who),
      });
    }
  };
}

export function createAdminProductImportsRouter(requireAdmin, options) {
  const router = Router();
  router.use(requireAdmin);
  router.get('/template', download(true));
  router.get('/export', download(false));
  router.get('/capabilities', (_req, res) => res.json({ extraction: Boolean(options.extractor) }));
  router.get('/history', async (_req, res) => {
    const entries = await AuditLog.find({ action })
      .sort({ at: -1, _id: -1 })
      .limit(historyPageSize)
      .select('target after at who')
      .populate('who', 'name email')
      .lean();
    res.json(
      entries.map(({ _id, target, after, at, who }) => ({
        id: _id,
        file: target,
        mode: after.mode,
        counts: after.counts,
        at,
        actor: who?.email ?? who?.name ?? 'Administrator',
      })),
    );
  });
  router.post('/preview', productImportCapacity(importHandler(options, false)));
  router.post('/apply', productImportCapacity(importHandler(options, true)));
  router.post('/prefill', productImportCapacity(prefill));
  if (options.extractor)
    router.post(
      '/extract',
      productImportCapacity(async (req, res) => {
        const { sheet } = await readImportUpload(req, { extensions: extractionExtensions });
        res.json({ suggestions: await options.extractor.extract(sheet) });
      }),
    );
  return router;
}
