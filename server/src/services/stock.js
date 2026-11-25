import { Product } from '../models/product.js';
import { StockMovement } from '../models/stock-movement.js';
import { HttpError } from '../utils/http-error.js';
import { publicProductFilter } from '../utils/product-compliance.js';

export async function applyStockMovements(
  lines,
  { reason, order, actor, session, adjustmentReason },
) {
  if (!session?.inTransaction()) throw new Error('Stock mutations require a transaction.');
  for (const { product, delta } of lines) {
    if (!delta) continue;
    const sale = reason === 'sale';
    const adjustment = await Product.updateOne(
      {
        _id: product,
        ...(sale && publicProductFilter()),
        ...(delta < 0 && { stock: { $gte: -delta } }),
        ...(delta > 0 && { stock: { $lte: Number.MAX_SAFE_INTEGER - delta } }),
      },
      { $inc: { stock: delta, ...(sale && { sales: -delta }) } },
      { session },
    );
    if (!adjustment.matchedCount) {
      throw new HttpError(409, 'Stock or availability changed. Review and try again.');
    }
    if (reason === 'cancel') {
      await Product.updateOne(
        { _id: product, sales: { $gte: delta } },
        { $inc: { sales: -delta } },
        { session },
      );
    }
    await StockMovement.create([{ product, delta, reason, order, actor, adjustmentReason }], {
      session,
    });
  }
}

export function restockOrderItems(items, context) {
  return applyStockMovements(
    items.map(({ product, quantity }) => ({ product, delta: quantity })),
    context,
  );
}
