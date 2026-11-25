import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedProducts } from '../../server/scripts/products.js';
import { address, makeAdmin, shopper } from '../../server/test/store-fixture.js';
import { openAdminPreview } from './admin-preview.mjs';
import { eventually, openFormBrowser } from './form-browser.mjs';

const field = (id) => 'document.getElementById(' + JSON.stringify(id) + ')';
const button = (text) =>
  '[...document.querySelectorAll("button")].find(element => element.textContent.trim() === ' +
  JSON.stringify(text) + ' && element.getClientRects().length && !element.matches(":disabled"))';
const post = (body, status = 200) => ({ method: 'POST', body, status });

test('remaining admin pages load and provide working operation forms', { timeout: 110_000 }, async (t) => {
  const { site, api } = await openAdminPreview(t);
  const admin = await makeAdmin(api);
  const buyer = shopper(api);
  const email = 'browser-operations@example.test';
  await buyer('/auth/register', post({ name: 'Operations Buyer', email, password: 'sample-password' }, 201));
  const [product] = seedProducts;
  await buyer('/cart/items', post({ slug: product.slug, quantity: 1 }));
  const { value: { orderNumber } } = await buyer('/orders', post({ acceptPolicies: true, address }, 201));
  const orderPath = '/admin/orders/' + orderNumber;
  for (const status of ['confirmed', 'packed', 'shipped', 'delivered'])
    await admin(orderPath + '/status', { method: 'PATCH', body: { status } });
  await admin(orderPath + '/payment', { method: 'PATCH', body: { paymentStatus: 'collected' } });
  const { value: entry } = await buyer('/orders/' + orderNumber + '/returns', post({
    reason: 'defective', items: [{ slug: product.slug, quantity: 1 }],
  }, 201));
  const { value: ticket } = await buyer('/support', post({
    name: 'Operations Buyer', email, phone: address.phone, category: 'return', message: 'Please check the parcel.',
  }, 201));
  await buyer('/newsletter', post({ email, source: 'home', consent: true, textVersion: 'newsletter-v2' }, 204));

  const browser = await openFormBrowser(t);
  const run = browser.evaluate;
  const waitFor = (label, expression) => eventually(label, () => run(expression));
  const visible = (text) => 'document.body.innerText.includes(' + JSON.stringify(text) + ')';
  const waitText = (text) => waitFor(text, visible(text));
  const page = (path) => browser.navigate(site + '/admin/' + path);
  async function set(id, value, event = 'input') {
    const target = field(id);
    await waitFor(id, `!!${target} && !${target}.matches(':disabled')`);
    await run(`(() => { const input = ${target}; input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); })()`);
  }
  async function click(label) {
    const target = button(label);
    await waitFor(label, '!!' + target);
    await run(target + '.click()');
  }
  async function link(suffix) {
    const target = `document.querySelector('a[href$="${suffix}"]')`;
    await waitFor(suffix, '!!' + target);
    await run(target + '.click()');
  }

  await browser.resize(1440, 900);
  await page('login');
  await set('admin-email', 'admin@example.test');
  await set('admin-password', 'sample-password');
  await click('Sign in');
  await waitFor('admin dashboard', 'location.pathname === "/admin"');

  await page('returns');
  await waitText(orderNumber);
  await link('/returns/' + entry.id);
  await waitText('Refund limit');
  await set('return-action', 'approved', 'change');
  await click('Save return');
  await waitText('Approved');
  await set('return-action', 'received', 'change');
  await set('return-condition-' + product.slug, 'resalable', 'change');
  await click('Save return');
  await waitText('Resalable');
  await set('return-action', 'refunded', 'change');
  await set('return-amount', '1.25');
  await click('Save return');
  await waitText('Refund recorded');

  await page('support');
  await waitText(ticket.ticketNumber);
  await link('/support/' + ticket.ticketNumber);
  await waitText('Acknowledgement (48 hours)');
  await waitText('Resolution (within 30 days)');
  await click('Acknowledge ticket');
  await set('support-reply', 'We checked your parcel.');
  await click('Add reply');
  await waitText('We checked your parcel.');
  await click('Mark resolved');
  await click('Close ticket');
  await waitText('Closed');
  assert.equal(await run('!!' + field('support-reply')), false);

  await page('customers');
  await waitText(email);
  assert.equal(await run(`document.querySelector('td[data-label="Orders"]').textContent.trim()`), '1');
  await browser.resize(390, 840);
  await waitFor('mobile customer cards', `getComputedStyle(document.querySelector('.admin-list tbody')).display === 'grid'`);
  assert.ok(await run('document.documentElement.scrollWidth <= innerWidth + 1'));

  await page('coupons');
  await click('Create coupon');
  await set('coupon-code', 'BROWSER-OPS');
  await set('coupon-percent', '12');
  await set('coupon-total-limit', '10');
  await set('coupon-customer-limit', '2');
  await click('Save coupon');
  await waitFor('coupon list entry', `!!document.querySelector('button[aria-label="Edit BROWSER-OPS"]')`);
  await run(`document.querySelector('button[aria-label="Edit BROWSER-OPS"]').click()`);
  await set('coupon-customer-limit', '3');
  await run(`document.querySelector('[name="active"]').click()`);
  await click('Save coupon');
  await waitText('Inactive');

  await page('blocked-contacts');
  await set('block-pincode', '411001');
  await set('block-reason', 'Test delivery issue');
  await click('Block contact');
  await waitText('Test delivery issue');
  await click('Remove');
  await set('unblock-reason', 'Test resolved');
  await click('Confirm removal');
  await waitText('0 blocked contacts');

  await page('newsletter');
  await waitText(email);
  await set('admin-list-search', email);
  await click('Apply filters');
  await waitFor('filtered newsletter download', `document.querySelector('a[href*="/newsletter/export"]')?.href.includes('q=browser-operations%40example.test')`);
});
