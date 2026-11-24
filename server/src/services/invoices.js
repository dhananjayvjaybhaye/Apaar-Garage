import {
  financialYearStartMonth,
  invoicePrefix,
  invoiceSequenceWidth,
} from '../config/business.js';
import { InvoiceCounter } from '../models/invoice-counter.js';
import { HttpError } from '../utils/http-error.js';
import { findCustomerOrder } from './order-history.js';

const indiaCalendar = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: 'numeric',
});

export function financialYear(at) {
  const parts = Object.fromEntries(
    indiaCalendar.formatToParts(at).map(({ type, value }) => [type, value]),
  );
  const year = Number(parts.year) - Number(Number(parts.month) < financialYearStartMonth);
  return String(year).slice(-2) + '-' + String(year + 1).slice(-2);
}

export async function prepareInvoiceCounter(year) {
  // Create the key before the order transaction. A race to initialize it does not consume numbers.
  try {
    await InvoiceCounter.updateOne(
      { _id: year },
      { $setOnInsert: { sequence: 0 } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

export async function allocateInvoice(year, session, prefix = invoicePrefix) {
  const counter = await InvoiceCounter.findOneAndUpdate(
    { _id: year },
    { $inc: { sequence: 1 } },
    { session, returnDocument: 'after' },
  ).lean();
  return [prefix, year, String(counter.sequence).padStart(invoiceSequenceWidth, '0')].join('/');
}

function invoiceLine(item, registered) {
  const {
    slug,
    sku,
    name,
    hsn,
    quantity,
    mrpPaise,
    unitPricePaise,
    discountPaise,
    taxablePaise,
    taxPaise,
    gstRatePercent,
  } = item;
  return {
    slug,
    sku,
    name,
    hsn,
    quantity,
    mrpPaise,
    unitPricePaise,
    discountPaise,
    ...(registered && { taxablePaise, taxPaise, gstRatePercent }),
  };
}

export async function customerInvoice(filter) {
  const {
    number,
    seller,
    invoiceNumber,
    invoiceType,
    invoiceAt,
    items,
    taxBreakup,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    codFeePaise,
    totalPaise,
  } = await findCustomerOrder(filter);
  if (!invoiceNumber) throw new HttpError(404, 'The invoice is available after dispatch.');
  const registered = invoiceType === 'tax_invoice';
  return {
    orderNumber: number,
    invoiceNumber,
    invoiceType,
    issuedAt: invoiceAt,
    seller,
    items: items.map((item) => invoiceLine(item, registered)),
    ...(registered && { taxBreakup }),
    subtotalPaise,
    discountPaise,
    shippingPaise,
    codFeePaise,
    totalPaise,
  };
}
