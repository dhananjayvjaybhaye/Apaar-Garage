import { z } from 'zod';
import { indiaOffsetMinutes } from '../config/admin-panel.js';
import { millisecondsPerDay, orderStatuses } from '../config/business.js';
import { Order } from '../models/order.js';
import { validate } from '../utils/http-error.js';
import { normalizeIndianPhone } from '../utils/indian-phone.js';
import { confirmationQueue, orderActions } from './order-confirmation.js';
import { maskPhone } from './admin-contact-access.js';

const pageSize = 20;
const orderFields = 'number createdAt address.fullName address.phone address.pincode status ' +
  'totalPaise paymentMethod paymentStatus risk.flags needsConfirmation customerConfirmation.status';
const sorts = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  highest: { totalPaise: -1, _id: -1 },
  lowest: { totalPaise: 1, _id: 1 },
};
const toggle = z.literal('1').optional();
const filters = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: z.enum(orderStatuses).optional(),
  flagged: toggle,
  needsConfirmation: toggle,
  codToCollect: toggle,
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest'),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
}).refine(({ from, to }) => !from || !to || from <= to, 'The end date must follow the start date.');

function dayStart(date) {
  return Date.parse(date + 'T00:00:00Z') - indiaOffsetMinutes * 60_000;
}

function findFilter(input, risk, fullContact) {
  const clauses = [];
  if (input.q) {
    const literal = RegExp.escape(input.q);
    const phone = normalizeIndianPhone(input.q);
    const phoneFilter = fullContact && /^\d+$/.test(phone)
      ? new RegExp(phone)
      : /^[6-9]\d{9}$/.test(phone) ? phone : null;
    clauses.push({ $or: [
      { number: new RegExp('^' + literal, 'i') },
      { 'address.fullName': new RegExp(literal, 'i') },
      ...(phoneFilter ? [{ 'address.phone': phoneFilter }] : []),
      ...(/^\d{1,6}$/.test(input.q) ? [{ 'address.pincode': new RegExp('^' + literal) }] : []),
    ] });
  }
  if (input.status) clauses.push({ status: input.status });
  if (input.flagged) clauses.push({ 'risk.flags.0': { $exists: true } });
  if (input.needsConfirmation) clauses.push(confirmationQueue(risk));
  if (input.codToCollect) {
    clauses.push({ status: 'delivered', paymentMethod: 'cod', paymentStatus: { $ne: 'collected' } });
  }
  if (input.from || input.to) {
    clauses.push({ createdAt: {
      ...(input.from && { $gte: new Date(dayStart(input.from)) }),
      ...(input.to && { $lt: new Date(dayStart(input.to) + millisecondsPerDay) }),
    } });
  }
  return clauses.length ? { $and: clauses } : {};
}

function summary(order, risk, fullContact = true) {
  return {
    orderNumber: order.number,
    createdAt: order.createdAt,
    customer: order.address?.fullName,
    phone: fullContact ? order.address?.phone : maskPhone(order.address?.phone),
    pincode: order.address?.pincode,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalPaise: order.totalPaise,
    flagged: Boolean(order.risk?.flags?.length),
    needsConfirmation: orderActions(order, risk).confirmationBlocked,
  };
}

export function readOrderQuery(query, risk, fullContact = true) {
  const input = validate(filters, query);
  const filter = findFilter(input, risk, fullContact);
  return { filter, page: input.page, list: Order.find(filter).select(orderFields).sort(sorts[input.sort]).lean() };
}

export async function listAdminOrders({ filter, page, list }, risk, fullContact) {
  const [orders, total] = await Promise.all([
    list.skip((page - 1) * pageSize).limit(pageSize),
    Order.countDocuments(filter),
  ]);
  return { items: orders.map((order) => summary(order, risk, fullContact)), page, total, totalPages: Math.ceil(total / pageSize) };
}

export async function* orderRecords({ list }, risk) {
  yield ['orderNumber', 'createdAt', 'customer', 'phone', 'pincode', 'status', 'paymentMethod',
    'paymentStatus', 'totalPaise', 'riskFlagged', 'needsConfirmation'];
  const cursor = list.cursor();
  try {
    for await (const order of cursor) {
      const row = summary(order, risk);
      yield [row.orderNumber, row.createdAt.toISOString(), row.customer, row.phone, row.pincode,
        row.status, row.paymentMethod, row.paymentStatus, row.totalPaise, row.flagged, row.needsConfirmation];
    }
  } finally {
    await cursor.close();
  }
}
