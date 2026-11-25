import { createHmac, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Product } from '../models/product.js';
import { ProductImportRow } from '../models/product-import-row.js';
import { previewLifetimeSeconds } from '../config/product-import.js';
import { HttpError } from '../utils/http-error.js';
import { saveProduct } from './admin-products.js';
import { applyStockMovements } from './stock.js';
import { transaction } from './transaction.js';
import { productRevision } from './product-import-plan.js';
import { convertProductImage } from './product-media.js';

const proofScope = 'product-import-preview';
const keyFor = (secret) => createHmac('sha256', secret).update(proofScope).digest();
const canApply = ({ status }) => status === 'create' || status === 'update';

export function signImportPreview(secret, plan, mode, actor) {
  return jwt.sign(
    {
      batch: plan.batch,
      mode,
      rows: plan.rows.filter(canApply).map(({ number, revision }) => [number, revision]),
    },
    keyFor(secret),
    { subject: String(actor), audience: proofScope, expiresIn: previewLifetimeSeconds },
  );
}

export function verifyImportPreview(secret, proof, batch, mode, actor) {
  try {
    const payload = jwt.verify(proof, keyFor(secret), {
      algorithms: ['HS256'],
      subject: String(actor),
      audience: proofScope,
    });
    if (payload.batch !== batch || payload.mode !== mode)
      throw new Error('Preview does not match.');
    return new Map(payload.rows);
  } catch {
    throw new HttpError(
      409,
      'This upload or confirmation has changed or expired. Run a new preview.',
    );
  }
}

async function removeStaged(assets) {
  await Promise.allSettled(assets.map(({ remove }) => remove()));
}

async function persistRow(row, approvedRevision, plan, media, audit) {
  const staged = [];
  const attempt = randomUUID();
  let beganTransaction = false;
  try {
    for (const name of row.names) {
      const bytes = await convertProductImage(plan.images.get(name));
      staged.push(await media.store(bytes, 'webp'));
    }
    const values = { ...row.values };
    if (staged.length) {
      values.images = [
        ...values.images.slice(0, values.images.length - staged.length),
        ...staged.map(({ url }) => url),
      ];
    }
    beganTransaction = true;
    const outcome = await transaction(async (session) => {
      if (await ProductImportRow.exists({ _id: row.receipt }).session(session)) return 'unchanged';
      const existing = await Product.findOne({ sku: values.sku })
        .select('+costPrice')
        .session(session)
        .lean();
      if ((existing ? productRevision(existing) : '') !== approvedRevision)
        throw new HttpError(409, 'The product changed after preview. Preview the sheet again.');
      await ProductImportRow.create([{ _id: row.receipt, attempt }], { session });
      const { stock, ...listing } = values;
      const oldStock = existing?.stock ?? 0;
      const product = existing ? Product.hydrate(existing) : new Product({ stock: 0 });
      product.set(listing);
      if (row.clearAlt) product.set('imageAlts', undefined);
      await saveProduct(product, session);
      await applyStockMovements([{ product: product._id, delta: stock - oldStock }], {
        reason: 'import',
        actor: audit.who,
        session,
      });
      return existing ? 'update' : 'create';
    });
    if (outcome === 'unchanged') await removeStaged(staged);
    return { ...row, status: outcome };
  } catch (error) {
    // A connection may fail after commit. Keep photos if this attempt owns the receipt.
    const receipt = beganTransaction
      ? await ProductImportRow.findById(row.receipt).select('attempt').lean().catch(() => undefined)
      : null;
    if (receipt?.attempt === attempt) return row;
    if (receipt || (receipt === null && !error.hasErrorLabel?.('UnknownTransactionCommitResult')))
      await removeStaged(staged);
    if (receipt) return { ...row, status: 'unchanged', errors: [] };
    const issues =
      error instanceof HttpError
        ? (error.details ?? [{ field: 'row', message: error.message }])
        : [{ field: 'row', message: 'This row could not be saved. Review it and try again.' }];
    return { ...row, status: 'error', errors: issues };
  }
}

export async function applyImport(plan, approved, media, audit) {
  const results = [];
  for (const row of plan.rows) {
    const revision = approved.get(row.number);
    if (row.status === 'unchanged' || row.status === 'error') results.push(row);
    else if (revision === undefined || row.revision !== revision) {
      results.push({
        ...row,
        status: 'error',
        errors: [
          {
            field: 'row',
            message: 'This product was not approved or changed after preview. Preview again.',
          },
        ],
      });
    } else results.push(await persistRow(row, revision, plan, media, audit));
  }
  return results;
}
