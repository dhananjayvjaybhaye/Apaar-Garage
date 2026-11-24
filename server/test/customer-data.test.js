import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { complaintDueAt } from '../src/utils/complaint-deadline.js';
import { millisecondsPerDay } from '../src/config/business.js';
import { NewsletterSubscriber } from '../src/models/newsletter-subscriber.js';
import { Order } from '../src/models/order.js';
import { SupportRequest } from '../src/models/support-request.js';
import { User } from '../src/models/user.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const credentials = {
  email: 'privacy-user@example.test',
  password: 'sample-password',
  name: 'Privacy Buyer',
};
const subscription = {
  email: credentials.email,
  source: 'home',
  textVersion: 'newsletter-v2',
  consent: true,
};
const ticketInput = {
  name: credentials.name,
  email: credentials.email,
  phone: '+91 98765 43210',
  category: 'grievance',
  message: 'Sample private request.',
};
const post = (body, status) => ({ method: 'POST', body, status });

test('support deadlines and customer-controlled data', async (t) => {
  const origin = await startStore(t, { ORDER_RETENTION_DAYS: '60' }, { orderEmailEnabled: true });
  const admin = await makeAdmin(origin);
  const account = shopper(origin);
  const visitor = shopper(origin);
  await account('/auth/register', post(credentials, 201));
  let ticketNumber;

  await t.test('ticket deadlines, private lookup and reply thread', async () => {
    const { value: ticket, headers } = await account('/support', post(ticketInput, 201));
    ticketNumber = ticket.ticketNumber;
    assert.match(ticketNumber, /^AGT-[0-9A-F]{16}$/);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(
      Date.parse(ticket.acknowledgeBy) - Date.parse(ticket.createdAt),
      2 * millisecondsPerDay,
    );
    assert.equal(ticket.dueAt, complaintDueAt(new Date(ticket.createdAt)).toISOString());
    assert.equal(
      complaintDueAt(new Date('2026-01-31T11:00:00Z')).toISOString(),
      '2026-02-28T11:00:00.000Z',
    );
    await visitor('/support/status', post({ ticketNumber, email: 'other@example.test' }, 404));
    const filter = { ticketNumber, email: credentials.email.toUpperCase() };
    assert.equal((await visitor('/support/status', post(filter))).value.status, 'open');
    const staff = '/admin/support/' + ticketNumber;
    const ack = await admin(staff, {
      method: 'PATCH',
      body: { reply: 'We received your request.' },
    });
    assert.equal(ack.value.status, 'acknowledged');
    assert.ok(ack.value.acknowledgedAt);
    await visitor('/support/reply', post({ ...filter, message: 'My follow-up.' }));
    const resolved = await admin(staff, { method: 'PATCH', body: { status: 'resolved' } });
    assert.equal(resolved.value.acknowledgedAt, ack.value.acknowledgedAt);
    const lookup = (await visitor('/support/status', post(filter))).value;
    assert.equal(lookup.status, 'resolved');
    assert.deepEqual(
      lookup.replies.map(({ from }) => from),
      ['support', 'customer'],
    );
    assert.ok(!Object.hasOwn(lookup, 'email'));
  });

  await t.test('consent is recorded and one-click unsubscribe is idempotent', async () => {
    await visitor('/newsletter', post({ ...subscription, consent: false }, 400));
    await account('/newsletter', post(subscription, 204));
    const subscriber = await NewsletterSubscriber.findById(credentials.email).lean();
    assert.equal(subscriber.consent.source, 'home');
    assert.equal(subscriber.consent.textVersion, 'newsletter-v2');
    assert.ok(subscriber.consent.at);
    const tokenRoute = '/admin/newsletter/unsubscribe-token';
    await visitor(tokenRoute, post({ email: credentials.email }, 401));
    const { value } = await admin(tokenRoute, post({ email: credentials.email }));
    const unsubscribe = '/newsletter/unsubscribe/' + value.token;
    await visitor(unsubscribe, post(undefined, 204));
    await visitor(unsubscribe, post(undefined, 204));
    assert.ok((await NewsletterSubscriber.findById(credentials.email).lean()).unsubscribedAt);
    await admin(tokenRoute, post({ email: credentials.email }, 404));
    await account('/newsletter', post(subscription, 204));
    const rotated = (await admin(tokenRoute, post({ email: credentials.email }))).value.token;
    assert.notEqual(rotated, value.token);
    await visitor(unsubscribe, post(undefined, 204));
    assert.equal(
      (await NewsletterSubscriber.findById(credentials.email).lean()).unsubscribedAt,
      undefined,
    );
  });

  await t.test(
    'account export and deletion protect open orders, scrub personal data and retain totals',
    async () => {
      await visitor('/account/export', { status: 401 });
      const owner = await User.findOne({ email: credentials.email }).lean();
      await account('/cart/items', post({ slug: seedProducts[0].slug, quantity: 1 }));
      const {
        value: { orderNumber },
      } = await account('/orders', post({ acceptPolicies: true, address, saveAddress: true }, 201));
      const exportResponse = await account('/account/export');
      assert.match(exportResponse.headers.get('content-disposition'), /attachment/);
      assert.equal(exportResponse.value.orders[0].address.phone, address.phone);
      assert.equal(exportResponse.value.tickets[0].ticketNumber, ticketNumber);
      assert.equal(exportResponse.value.subscription.consent.textVersion, 'newsletter-v2');
      assert.ok(!JSON.stringify(exportResponse.value).includes('passwordHash'));
      await account('/account/delete', post({ confirm: true, password: 'wrong' }, 401));
      const close = () =>
        account('/account/delete', post({ confirm: true, password: credentials.password }, 204));
      await account(
        '/account/delete',
        post({ confirm: true, password: credentials.password }, 409),
      );
      await account('/orders/' + orderNumber + '/cancel', post({ note: 'My private message' }));
      const prior = await Order.findOne({ number: orderNumber }).lean();
      assert.deepEqual(
        prior.emailEvents.map(({ kind }) => kind),
        ['placed', 'cancelled'],
      );
      await close();
      assert.equal(await User.findById(owner._id), null);
      await account('/account/export', { status: 401 });
      await account('/auth/me', { status: 401 });
      const anonymized = await Order.findOne({ number: orderNumber })
        .select('+emailAddress')
        .lean();
      assert.notEqual(anonymized.user.toString(), owner._id.toString());
      assert.equal(anonymized.address.fullName, 'Deleted customer');
      assert.equal(anonymized.address.phone, undefined);
      assert.equal(anonymized.emailAddress, undefined);
      assert.equal(anonymized.risk, undefined);
      assert.equal(anonymized.cancellation.note, undefined);
      assert.deepEqual(anonymized.emailEvents, []);
      assert.equal(anonymized.totalPaise, prior.totalPaise);
      assert.equal(+anonymized.purgeAfter - +prior.createdAt, 60 * millisecondsPerDay);
      assert.equal(await NewsletterSubscriber.findById(credentials.email), null);
      const ticket = await SupportRequest.findOne({ ticketNumber }).lean();
      assert.equal(ticket.email, undefined);
      assert.deepEqual(ticket.replies, []);
      await visitor('/support/status', post({ ticketNumber, email: credentials.email }, 404));
    },
  );
});
