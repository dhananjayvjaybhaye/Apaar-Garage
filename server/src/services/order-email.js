import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { Order } from '../models/order.js';
import { readOrderEmailOptions } from '../utils/config.js';

const statuses = {
  confirmed: 'Order confirmation',
  shipped: 'Order shipped',
  delivered: 'Order delivered',
};
const retryLimit = 6;
const minute = 60_000;

export function orderEmailEvent(kind) {
  return { kind, nextAttemptAt: new Date() };
}

export function createOrderMailer() {
  const config = readOrderEmailOptions();
  if (!config) return null;
  const { from, smtp } = config;
  const transport = nodemailer.createTransport({
    ...smtp,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return { from, transport };
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

async function deliverOrderEmails({ from, transport }) {
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
      .select('number totalPaise deliveryEstimate +emailAddress emailEvents')
      .lean();
    if (!order) return;
    const event = order.emailEvents.find((entry) => entry.lease === lease);
    const filter = { _id: order._id, 'emailEvents.lease': lease };
    try {
      await transport.sendMail(emailMessage(order, event.kind, from));
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

function emailMessage(order, kind, from) {
  const title = statuses[kind];
  const total = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    order.totalPaise / 100,
  );
  const status = {
    confirmed:
      'We received your order. Pay ' +
      total +
      ' in cash when it arrives. ' +
      order.deliveryEstimate,
    shipped: 'Your order is on its way. ' + order.deliveryEstimate,
    delivered:
      'Your order has been marked delivered. If you need help, use the Contact us form and include your order number.',
  };
  return {
    from: { name: 'Apaar Garage', address: from },
    to: order.emailAddress,
    subject: title + ' · ' + order.number,
    text: title + '\nOrder: ' + order.number + '\n\n' + status[kind],
    messageId: '<' + order.number + '.' + kind + '@' + from.split('@').at(-1) + '>',
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
