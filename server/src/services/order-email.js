import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { Order } from '../models/order.js';
import { readOrderEmailOptions } from '../utils/config.js';

const statuses = {
  placed: 'Order received',
  confirmed: 'Order confirmation',
  shipped: 'Order shipped',
  delivered: 'Order delivered',
  cancelled: 'Order cancelled',
};
const retryLimit = 6;
const minute = 60_000;
const storeName = 'Apaar Garage';
const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

export function createOrderMailer() {
  const config = readOrderEmailOptions();
  if (!config) return null;
  const { from, logoUrl, smtp } = config;
  const transport = nodemailer.createTransport({
    ...smtp,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return { from, logoUrl, transport };
}

export function startOrderEmailWorker(mailer) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverOrderEmails(mailer);
    } catch {
      console.error('Order email queue could not be processed. The worker will retry.');
    } finally {
      running = false;
    }
  };
  setInterval(tick, 15_000).unref();
  void tick();
}

async function deliverOrderEmails({ from, logoUrl, transport }) {
  for (let count = 0; count < 12; count++) {
    const now = new Date();
    const lease = randomUUID();
    const order = await Order.findOneAndUpdate(
      { emailEvents: { $elemMatch: { nextAttemptAt: { $lte: now } } } },
      {
        $set: {
          'emailEvents.$.lease': lease,
          'emailEvents.$.nextAttemptAt': new Date(now.getTime() + 3 * minute),
        },
        $inc: { 'emailEvents.$.attempts': 1 },
      },
      { returnDocument: 'after', sort: { 'emailEvents.nextAttemptAt': 1 }, timestamps: false },
    )
      .select('number status totalPaise deliveryEstimate +emailAddress emailEvents')
      .lean();
    if (!order) return;
    const event = order.emailEvents.find((entry) => entry.lease === lease);
    const filter = { _id: order._id, 'emailEvents.lease': lease };
    if (!order.emailAddress || !(await Order.exists(filter))) continue;
    try {
      // Older queues used the confirmation event when an order was only placed.
      const kind = event.kind === 'confirmed' && order.status === 'placed' ? 'placed' : event.kind;
      await transport.sendMail(emailMessage(order, kind, from, logoUrl));
    } catch {
      if (event.attempts < retryLimit) {
        await Order.updateOne(
          filter,
          {
            $set: {
              'emailEvents.$.nextAttemptAt': new Date(
                Date.now() + minute * 2 ** (event.attempts - 1),
              ),
            },
            $unset: { 'emailEvents.$.lease': 1 },
          },
          { timestamps: false },
        );
      } else {
        await Order.updateOne(
          filter,
          {
            $set: { 'emailEvents.$.failedAt': new Date() },
            $unset: { 'emailEvents.$.lease': 1, 'emailEvents.$.nextAttemptAt': 1 },
          },
          { timestamps: false },
        );
        console.error('An order email reached the retry limit.');
      }
      continue;
    }
    await Order.updateOne(
      filter,
      {
        $set: { 'emailEvents.$.sentAt': new Date() },
        $unset: { 'emailEvents.$.lease': 1, 'emailEvents.$.nextAttemptAt': 1 },
      },
      { timestamps: false },
    );
  }
}

export function emailMessage(order, kind, from, logoUrl) {
  const title = statuses[kind];
  const total = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    order.totalPaise / 100,
  );
  const status = {
    placed:
      'We received your order. Pay ' +
      total +
      ' in cash when it arrives. ' +
      order.deliveryEstimate,
    confirmed: 'We confirmed your order. ' + order.deliveryEstimate,
    cancelled: 'Your order has been cancelled. Contact customer care if you need help.',
    shipped: 'Your order is on its way. ' + order.deliveryEstimate,
    delivered:
      'Your order has been marked delivered. If you need help, use the Contact us form and include your order number.',
  };
  const brandImage = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="140" height="75" alt="${storeName}" style="display:block;border:0">`
    : '';
  return {
    from: { name: storeName, address: from },
    to: order.emailAddress,
    subject: title + ' · ' + order.number,
    text: storeName + '\n' + title + '\nOrder: ' + order.number + '\n\n' + status[kind],
    html: `${brandImage}<p><strong>${storeName}</strong></p><h1>${escapeHtml(title)}</h1>
      <p>Order: ${escapeHtml(order.number)}</p><p>${escapeHtml(status[kind])}</p>`,
    messageId: '<' + order.number + '.' + kind + '@' + from.split('@').at(-1) + '>',
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
