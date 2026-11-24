import { defaultReturnDays, millisecondsPerDay } from '../config/business.js';
import { ReturnRequest } from '../models/return-request.js';
import { HttpError } from '../utils/http-error.js';

function deliveryTime(order) {
  return (
    order.shipment?.deliveredAt ??
    order.statusHistory?.findLast(({ status }) => status === 'delivered')?.at
  );
}

function resolveLine(order, line, reserved, at) {
  const item = order.items.find(({ slug }) => slug === line.slug);
  if (!item) throw new HttpError(400, 'Return items must be on this order.');
  const windowDays = item.returnWindowDays ?? defaultReturnDays;
  const deliveredAt = deliveryTime(order);
  if (!deliveredAt || !windowDays || at - deliveredAt > windowDays * millisecondsPerDay) {
    throw new HttpError(409, 'The return window has closed for ' + item.name + '.');
  }
  const { quantity, amount } = reserved.get(line.slug) ?? { quantity: 0, amount: 0 };
  if (quantity + line.quantity > item.quantity) {
    throw new HttpError(409, 'The requested quantity is already returned or reserved.');
  }

  const paid = item.quantity * item.unitPricePaise - (item.discountPaise ?? 0);
  // Allocate whole paise per unit. The final reservation reconciles the paid line balance.
  const share =
    quantity + line.quantity === item.quantity
      ? paid - amount
      : Number((BigInt(paid) * BigInt(line.quantity)) / BigInt(item.quantity));
  return {
    product: item.product,
    slug: item.slug,
    quantity: line.quantity,
    maximumRefundPaise: Math.min(share, paid - amount),
  };
}

export async function reserveReturnLines(order, lines, at, session) {
  const existing = await ReturnRequest.find({
    orderNumber: order.number,
    status: { $ne: 'rejected' },
  })
    .select('items')
    .session(session)
    .lean();
  const reserved = new Map();
  for (const request of existing) {
    for (const line of request.items) {
      const totals = reserved.get(line.slug) ?? { quantity: 0, amount: 0 };
      totals.quantity += line.quantity;
      totals.amount += line.maximumRefundPaise;
      reserved.set(line.slug, totals);
    }
  }
  return lines.map((line) => resolveLine(order, line, reserved, at));
}
