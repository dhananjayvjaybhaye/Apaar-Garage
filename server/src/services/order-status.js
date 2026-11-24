import { adminCancellable, orderTransitions } from '../config/business.js';
import { recordAudit } from './audit.js';
import { orderSummary } from './audit-summaries.js';
import { Order } from '../models/order.js';
import { HttpError } from '../utils/http-error.js';
import { allocateInvoice, financialYear, prepareInvoiceCounter } from './invoices.js';
import { notify } from './notifications.js';
import { holdCodLocks, prepareCodLocks, privateKey } from './cod-risk.js';
import { cancelOrder } from './order-service.js';
import { restockOrderItems } from './stock.js';
import { transaction } from './transaction.js';

async function statusFields(status, input, order, options, at, year, session) {
  switch (status) {
    case 'shipped': {
      const seller = order.seller ?? options.seller;
      // Historical orders without tax snapshots can only receive a bill with no tax lines.
      const registered = seller.gstRegistered && Array.isArray(order.taxBreakup);
      return {
        seller,
        invoiceNumber:
          order.invoiceNumber ?? (await allocateInvoice(year, session, seller.invoicePrefix)),
        invoiceType: registered ? 'tax_invoice' : 'bill_of_supply',
        invoiceAt: at,
        shipment: { ...input.shipment, shippedAt: at },
      };
    }
    case 'delivered':
      return { 'shipment.deliveredAt': at };
    case 'undelivered':
      return {
        'shipment.undeliveredReason': input.reasonCode,
        ...(input.note && { 'shipment.undeliveredNote': input.note }),
        ...(order.paymentStatus === 'pending' && { paymentStatus: 'failed' }),
      };
    case 'returned_to_seller':
      return { 'shipment.returnedToSellerAt': at, 'shipment.returnCondition': input.condition };
    default:
      return {};
  }
}

export function changeOrderStatus(orderNumber, input, options, audit) {
  const { status } = input;
  if (status === 'cancelled') {
    return cancelOrder({ number: orderNumber }, adminCancellable, {
      ...input,
      actor: audit.who,
      auditIp: audit.ip,
      reasonCode: input.reasonCode ?? 'admin_cancelled',
      notifications: options,
    });
  }
  return transitionOrder(orderNumber, input, options, audit);
}

async function transitionOrder(orderNumber, input, options, audit) {
  const { status } = input;
  const at = new Date();
  const year = financialYear(at);
  if (status === 'shipped') await prepareInvoiceCounter(year);
  let failedDeliveryKeys;
  if (status === 'undelivered') {
    const current = await Order.findOne({ number: orderNumber }).select('address.phone').lean();
    if (current?.address?.phone) {
      failedDeliveryKeys = {
        phoneKey: privateKey(options.riskSecret, 'cod-phone', current.address.phone),
      };
      await prepareCodLocks(failedDeliveryKeys);
    }
  }
  return transaction(async (session) => {
    const order = await Order.findOne({ number: orderNumber })
      .select('+emailAddress')
      .session(session)
      .lean();
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === status) return order;
    if (!orderTransitions[order.status]?.includes(status)) {
      throw new HttpError(409, 'That order status transition is not allowed.');
    }
    const aboveLimit =
      options.risk.confirmationAbovePaise !== null &&
      order.totalPaise > options.risk.confirmationAbovePaise;
    if (
      status === 'packed' &&
      (order.needsConfirmation || order.risk?.flags?.length || aboveLimit) &&
      order.customerConfirmation?.status !== 'confirmed'
    ) {
      throw new HttpError(409, 'Confirm the order with the customer before packing.');
    }
    if (failedDeliveryKeys) await holdCodLocks(failedDeliveryKeys, session);
    const fields = await statusFields(status, input, order, options, at, year, session);
    const notice = notify(order, status, options, at);
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      {
        $set: { status, ...fields },
        $push: {
          statusHistory: { status, at },
          ...(notice && { emailEvents: notice }),
        },
      },
      { session, returnDocument: 'after', runValidators: true },
    ).lean();
    if (!updated) throw new HttpError(409, 'The order changed. Reload and try again.');
    if (status === 'returned_to_seller' && input.condition === 'resalable') {
      await restockOrderItems(order.items, {
        reason: 'rto',
        order: order.number,
        actor: audit.who,
        session,
      });
    }
    await recordAudit(
      'order.status_changed',
      { ...audit, target: order.number, before: orderSummary(order), after: orderSummary(updated) },
      session,
    );
    return updated;
  });
}

export function collectOrderPayment(orderNumber, audit) {
  return transaction(async (session) => {
    const order = await Order.findOne({ number: orderNumber }).session(session).lean();
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'delivered' || order.paymentMethod !== 'cod')
      throw new HttpError(409, 'Mark COD collected only after delivery.');
    if (order.paymentStatus === 'collected') return order;
    const updated = await Order.findByIdAndUpdate(
      order._id,
      { $set: { paymentStatus: 'collected' } },
      { returnDocument: 'after', session },
    ).lean();
    await recordAudit(
      'order.payment_collected',
      { ...audit, target: orderNumber, before: orderSummary(order), after: orderSummary(updated) },
      session,
    );
    return updated;
  });
}

export function updateOrderAdministration(orderNumber, update, audit, action) {
  return transaction(async (session) => {
    const order = await Order.findOne({ number: orderNumber }).session(session).lean();
    if (!order) throw new HttpError(404, 'Order not found.');
    const updated = await Order.findByIdAndUpdate(order._id, update, {
      returnDocument: 'after',
      runValidators: true,
      session,
    }).lean();
    await recordAudit(
      action,
      { ...audit, target: orderNumber, before: orderSummary(order), after: orderSummary(updated) },
      session,
    );
    return updated;
  });
}
