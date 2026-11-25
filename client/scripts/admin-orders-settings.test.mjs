import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedProducts } from '../../server/scripts/products.js';
import { createOrPromoteAdministrator } from '../../server/src/services/admin-bootstrap.js';
import { address, shopper } from '../../server/test/store-fixture.js';
import { openAdminPreview } from './admin-preview.mjs';
import { eventually, openFormBrowser } from './form-browser.mjs';

const button = (text) =>
  '[...document.querySelectorAll("button")].find(button => button.textContent.trim() === ' +
  JSON.stringify(text) + ' && button.getClientRects().length && !button.disabled)';
const field = (id) => 'document.getElementById(' + JSON.stringify(id) + ')';
const post = (body, status = 200) => ({ method: 'POST', body, status });

test('Orders and Settings are reachable and support the admin workflows', { timeout: 110_000 }, async (t) => {
  const { site, api } = await openAdminPreview(t, { COD_CONFIRM_ABOVE: '1' });
  const buyer = shopper(api);
  await buyer('/cart/items', post({ slug: seedProducts[0].slug, quantity: 1 }));
  const { value: order } = await buyer('/orders', post({ acceptPolicies: true, address }, 201));
  await createOrPromoteAdministrator('staff@example.test', 'sample-password', 'staff');

  const browser = await openFormBrowser(t);
  const run = browser.evaluate;
  const waitFor = (label, expression) => eventually(label, () => run(expression));
  const text = (value) => 'document.body.innerText.includes(' + JSON.stringify(value) + ')';
  async function set(id, value, event = 'input') {
    const selector = field(id);
    await waitFor(id, `!!${selector} && !${selector}.matches(':disabled')`);
    await run(`(() => { const el = ${selector}; el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); })()`);
  }
  async function click(label) {
    await waitFor(label, '!!' + button(label));
    await run(button(label) + '.click()');
  }
  async function login(email) {
    await browser.navigate(site + '/admin/login');
    await waitFor('sign-in form', '!!' + field('admin-email'));
    await set('admin-email', email);
    await set('admin-password', 'sample-password');
    await click('Sign in');
    await waitFor('admin dashboard', `location.pathname === '/admin'`);
  }

  await browser.resize(1440, 900);
  await login('admin@example.test');
  await browser.navigate(site + '/admin/orders');
  await waitFor('order table', `!!document.querySelector('.admin-table tbody a')`);
  assert.equal(await run(`document.querySelector('.admin-table tbody a').textContent.trim()`), order.orderNumber);
  await set('order-search', 'not-a-matching-order');
  await click('Apply filters');
  await waitFor('empty filtered orders', text('0 matching orders'));
  await set('order-search', address.pincode);
  await click('Apply filters');
  await waitFor('matching orders', text('1 matching orders'));
  assert.match(await run(`document.querySelector('a[href*="/orders/export"]').href`), /q=411001/);
  await browser.resize(390, 840);
  await waitFor('mobile cards', `getComputedStyle(document.querySelector('.order-cards')).display === 'grid'`);
  assert.equal(await run(`getComputedStyle(document.querySelector('.admin-table-wrap')).display`), 'none');
  await run(`document.querySelector('.order-cards a').click()`);
  await waitFor('risk warning', text('Confirm the order with the customer before packing.'));
  await click('Confirm order');
  await waitFor('order confirmed', text('Order updated.'));
  assert.equal(await run('!!' + button('Pack')), false);
  await click('Confirmed');
  await click('Pack');
  await set('order-courier', 'Test Courier');
  await set('order-awb', 'TEST-101');
  await set('order-tracking-url', 'https://example.test/track');
  await click('Mark shipped');
  await waitFor('invoice link', text('Bill of supply'));
  await set('order-note', 'Test packing note');
  await click('Add note');
  await waitFor('note persisted', text('Test packing note'));
  await click('Mark delivered');
  await click('Mark COD collected');
  await waitFor('COD collected', text('COD · Collected'));
  await run(`document.querySelector('a[href$="/packing-slip"]').click()`);
  await waitFor('printable packing slip', text('Print packing slip'));
  await browser.navigate(site + '/admin/orders/' + order.orderNumber + '/invoice');
  await waitFor('printable bill', text('Bill of supply'));
  await waitFor('print action', '!!' + button('Print invoice'));

  await browser.resize(1440, 900);
  await browser.navigate(site + '/admin/settings');
  await waitFor('readiness checklist', text('Customer care phone is missing.'));
  await waitFor('settings form', '!!' + field('setting-codFeePaise'));
  await set('setting-codFeePaise', '42.50');
  await set('setting-codMinPaise', '100');
  await set('setting-codMaxPaise', '50');
  await click('Save settings');
  await waitFor('server field validation', text('The COD maximum must cover the minimum.'));
  await set('setting-codMaxPaise', '500');
  await set('setting-customerCare.phone', '9876543210');
  await click('Add pincode rule');
  await set('pincode-1', '411');
  await set('estimate-1', 'Four days');
  await click('Save settings');
  await waitFor('settings saved', text('Settings saved.'));
  await waitFor('readiness refreshed', '!' + text('Customer care phone is missing.'));
  await browser.navigate(site + '/admin/settings');
  await waitFor('settings persisted', field('setting-codFeePaise') + '?.value === "42.50"');
  assert.equal(await run(field('estimate-1') + '.value'), 'Four days');

  await click('Sign out');
  await login('staff@example.test');
  await browser.navigate(site + '/admin/settings');
  await waitFor('staff settings fields', '!!' + field('setting-codFeePaise'));
  assert.ok(await run(field('setting-codFeePaise') + '.matches(":disabled")'));
  assert.equal(await run('!!' + button('Save settings')), false);

  for (const path of ['customers', 'coupons', 'blocked-contacts', 'product-import', 'products/new', 'users']) {
    await browser.navigate(site + '/admin/' + path);
    await waitFor('denied ' + path, `location.pathname === '/admin/no-access' && ${text("You don't have access")}`);
  }
  await waitFor('access heading receives focus', `document.activeElement?.tagName === 'H1' && document.activeElement.tabIndex === -1`);
  await browser.pressKey('Tab');
  assert.equal(await run('document.activeElement?.textContent.trim()'), 'Back to dashboard');
  await browser.pressKey('Enter');
  await waitFor('keyboard back to dashboard', `location.pathname === '/admin'`);
  assert.equal(await run(`!!document.querySelector('nav a[href="/admin/customers"], nav a[href="/admin/coupons"], nav a[href="/admin/blocked-contacts"]')`), false);
  await browser.navigate(site + '/admin/products');
  await waitFor('staff product list', `!!document.querySelector('td a[href$="/view"]')`);
  assert.equal(await run(`!!document.querySelector('a[href="/admin/products/new"], a[href="/admin/product-import"]')`), false);
  await run(`document.querySelector('td a[href$="/view"]').click()`);
  await waitFor('read-only product view', text('Back to products'));
  assert.equal(await run(`!!document.querySelector('main form')`), false);
  await browser.navigate(site + '/admin/orders');
  await waitFor('staff orders', text('98•••••210'));
  assert.equal(await run(`!!document.querySelector('a[href*="/orders/export"]')`), false);
  await browser.navigate(site + '/admin/newsletter');
  await waitFor('staff newsletter', text('0 matching subscription records'));
  assert.equal(await run(`!!document.querySelector('a[href*="/newsletter/export"]')`), false);
});
