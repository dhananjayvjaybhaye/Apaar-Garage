import { recordAudit } from './audit.js';
import { returnSummary } from './audit-summaries.js';
import { Order } from '../models/order.js';
import { ReturnRequest } from '../models/return-request.js';
import { HttpError } from '../utils/http-error.js';
import { findCustomerOrder } from './order-history.js';
import { reserveReturnLines } from './return-eligibility.js';
import { restockOrderItems } from './stock.js';
import { transaction } from './transaction.js';

const transitions = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['refunded', 'replaced'],
};

export function returnActions(request, order, refundLimit) {
  if (order?.status !== 'delivered') return [];
  return (transitions[request.status] ?? []).filter(
    (status) => status !== 'refunded' || (order.paymentStatus === 'collected' && refundLimit > 0),
  );
}

async function lockDeliveredOrder(filter, session) {
  // A write to the parent serializes reservations and return updates for this order.
  const order = await Order.findOneAndUpdate(
    { ...filter, status: 'delivered' },
    { $inc: { returnVersion: 1 } },
    { session, returnDocument: 'after' },
  ).lean();
  if (order) return order;
  if (!(await Order.exists(filter).session(session))) throw new HttpError(404, 'Order not found.');
  throw new HttpError(409, 'Only delivered orders can be returned.');
}

function notesFor(input, actor, at, internal) {
  return input.note ? [{ note: input.note, actor, at, internal }] : [];
}

export function requestReturn(filter, input, actor, ip) {
  return transaction(async (session) => {
    const order = await lockDeliveredOrder(filter, session);
    const at = new Date();
    const items = await reserveReturnLines(order, input.items, at, session);
    const maximumRefundPaise = items.reduce((sum, item) => sum + item.maximumRefundPaise, 0);
    const [request] = await ReturnRequest.create(
      [
        {
          orderNumber: order.number,
          items,
          maximumRefundPaise,
          reason: input.reason,
          notes: notesFor(input, actor, at, false),
        },
      ],
      { session },
    );
    const created = request.toObject();
    await recordAudit(
      'order.return_requested',
      {
        who: actor,
        target: order.number + '/' + String(created._id),
        ip,
        after: returnSummary(created),
      },
      session,
    );
    return created;
  });
}

export async function listReturns(filter) {
  const order = await findCustomerOrder(filter);
  return ReturnRequest.find({ orderNumber: order.number }).sort({ createdAt: -1 }).lean();
}

function receivingFields(request, conditions, at) {
  if (conditions.length !== request.items.length) {
    throw new HttpError(400, 'Provide a condition for each returned item.');
  }
  const bySlug = new Map(conditions.map(({ slug, condition }) => [slug, condition]));
  const items = request.items.map((item) => {
    const condition = bySlug.get(item.slug);
    if (!condition) throw new HttpError(400, 'Provide a condition for each returned item.');
    return { ...item, condition };
  });
  return { items, receivedAt: at };
}

export async function availableRefund(order, request, session = null) {
  const paid = await ReturnRequest.find({
    orderNumber: order.number,
    status: 'refunded',
  })
    .select('refundAmountPaise')
    .session(session)
    .lean();
  const refunded = paid.reduce((sum, result) => sum + result.refundAmountPaise, 0);
  return Math.max(0, Math.min(request.maximumRefundPaise ?? 0, order.totalPaise - refunded));
}

async function resolutionFields(order, request, input, at, session) {
  if (input.status === 'replaced') return { resolution: 'replacement', resolvedAt: at };
  if (order.paymentStatus !== 'collected') {
    throw new HttpError(409, 'Record the customer payment before refunding.');
  }
  if (input.refundAmountPaise > await availableRefund(order, request, session)) {
    throw new HttpError(409, 'The refund exceeds the amount paid for the returned items.');
  }
  return { resolution: 'refund', refundAmountPaise: input.refundAmountPaise, resolvedAt: at };
}

async function transitionFields(order, request, input, at, session) {
  if (input.status === 'received') return receivingFields(request, input.items, at);
  if (input.status === 'refunded' || input.status === 'replaced') {
    return resolutionFields(order, request, input, at, session);
  }
  return {};
}

export function changeReturn(orderNumber, id, input, audit) {
  return transaction(async (session) => {
    const order = await lockDeliveredOrder({ number: orderNumber }, session);
    const request = await ReturnRequest.findOne({ _id: id, orderNumber }).session(session).lean();
    if (!request) throw new HttpError(404, 'Return request not found.');
    if (request.status === input.status) return request;
    if (!transitions[request.status]?.includes(input.status)) {
      throw new HttpError(409, 'That return status transition is not allowed.');
    }
    const at = new Date();
    const fields = await transitionFields(order, request, input, at, session);
    const updated = await ReturnRequest.findOneAndUpdate(
      { _id: id, status: request.status },
      {
        $set: { status: input.status, ...fields },
        ...(input.note && { $push: { notes: { $each: notesFor(input, audit.who, at, true) } } }),
      },
      { session, returnDocument: 'after', runValidators: true },
    ).lean();
    if (!updated) throw new HttpError(409, 'The return changed. Reload and try again.');
    if (input.status === 'received') {
      await restockOrderItems(
        fields.items.filter(({ condition }) => condition === 'resalable'),
        {
          reason: 'return',
          order: orderNumber,
          actor: audit.who,
          session,
        },
      );
    }
    await recordAudit(
      input.status === 'refunded' ? 'order.refund_recorded' : 'order.return_changed',
      {
        ...audit,
        target: orderNumber + '/' + id,
        before: returnSummary(request),
        after: returnSummary(updated),
      },
      session,
    );
    return updated;
  });
}

export function publicReturn(request) {
  const {
    _id,
    orderNumber,
    items,
    reason,
    status,
    resolution,
    maximumRefundPaise,
    refundAmountPaise,
    notes,
    createdAt,
    updatedAt,
  } = request;
  return {
    id: _id,
    orderNumber,
    reason,
    status,
    resolution,
    maximumRefundPaise,
    refundAmountPaise,
    items: items.map(({ slug, quantity, condition }) => ({ slug, quantity, condition })),
    notes: notes.filter(({ internal }) => !internal).map(({ note, at }) => ({ note, at })),
    createdAt,
    updatedAt,
  };
}
