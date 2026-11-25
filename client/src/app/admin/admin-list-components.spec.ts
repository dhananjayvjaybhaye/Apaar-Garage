import type { Type } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { emptyPage, mountAdmin, onePage, serverError } from './admin-component-fixture';
import { AdminBlockedContacts } from './blocked-contacts/admin-blocked-contacts';
import { AdminCoupons } from './coupons/admin-coupons';
import { AdminCustomers } from './customers/admin-customers';
import { AdminNewsletter } from './newsletter/admin-newsletter';
import { AdminOrderList } from './orders/admin-order-list';
import { AdminReturns } from './returns/admin-returns';
import { AdminSupport } from './support/admin-support';

const screens: [string, Type<unknown>, string, string, string, string][] = [
  ['Orders', AdminOrderList, '/api/admin/orders?page=1', 'Loading orders', '0 matching orders', '#order-search'],
  ['Returns', AdminReturns, '/api/admin/returns?page=1', 'Loading returns', '0 matching returns', '#return-status'],
  ['Support', AdminSupport, '/api/admin/support?page=1', 'Loading tickets', '0 matching tickets', '#support-deadline'],
  ['Customers', AdminCustomers, '/api/admin/customers?page=1', 'Loading customers', '0 matching customers', '#admin-list-search'],
  ['Coupons', AdminCoupons, '/api/admin/coupons', 'Loading coupons', 'No matching coupons', '#coupon-search'],
  ['Blocked contacts', AdminBlockedContacts, '/api/admin/blocked-contacts?page=1', 'Loading blocked contacts', '0 blocked contacts', '#block-reason'],
  ['Newsletter', AdminNewsletter, '/api/admin/newsletter?page=1', 'Loading subscribers', '0 matching subscription records', '#subscriber-status'],
];

describe.each(screens)('%s list component', (_name, component, url, loading, empty, selector) => {
  it('has keyboard-reachable controls, loading, error, retry and empty states', async () => {
    const page = await mountAdmin(component);
    expect(page.root.querySelector('[role=status]')?.textContent).toContain(loading);
    const input = page.find(selector);
    expect(page.root.querySelector('label[for="' + input.id + '"]')).toBeTruthy();
    page.interactive(input);
    page.http.expectOne(url).flush({ message: 'Service unavailable' }, serverError);
    await page.verify(() => expect(page.root.querySelector('[role=alert]')?.textContent).toContain('Service unavailable'));
    const retry = page.button('Retry');
    page.interactive(retry);
    retry.click();
    page.fixture.detectChanges();
    page.http.expectOne(url).flush(emptyPage);
    await page.text(empty);
    page.http.verify();
  });
});

it('shows order status and masks as delivered by the API, and hides export for staff', async () => {
  const page = await mountAdmin(AdminOrderList, { permissions: ['orders.work'] });
  page.http.expectOne('/api/admin/orders?page=1').flush(onePage({
    orderNumber: 'AG-0123456789ABCD', createdAt: '2026-01-01T00:00:00Z', customer: 'Buyer',
    phone: '98•••••210', pincode: '411001', paymentMethod: 'cod', paymentStatus: 'pending',
    totalPaise: 1000, status: 'confirmed', flagged: true, needsConfirmation: true,
  }));
  await page.text('98•••••210');
  expect(page.root.textContent).toContain('Needs confirmation');
  expect(page.root.querySelector('a[href*="/export"]')).toBeNull();
  page.interactive(page.find('.order-cards a'));
  const search = page.field('#order-search', 'Buyer');
  search.form!.requestSubmit(page.button('Apply filters'));
  page.http.expectOne('/api/admin/orders?q=Buyer&sort=newest&page=1').flush(emptyPage);
  await page.text('0 matching orders');
  page.http.verify();
});

it('shows late, overdue and met support deadlines alongside the ticket link', async () => {
  const page = await mountAdmin(AdminSupport, { permissions: ['support.work'] });
  const past = '2000-01-01T00:00:00Z';
  const late = '2000-01-02T00:00:00Z';
  page.http.expectOne('/api/admin/support?page=1').flush({
    ...emptyPage, total: 2, totalPages: 1,
    items: [
      { _id: '1', ticketNumber: 'AGT-1111111111111111', status: 'acknowledged',
        email: 'c•••@e•••', acknowledgeBy: past, acknowledgedAt: late, dueAt: past },
      { _id: '2', ticketNumber: 'AGT-2222222222222222', status: 'resolved',
        acknowledgeBy: late, acknowledgedAt: past, dueAt: late, resolvedAt: late },
    ],
  });
  await page.text('AGT-1111111111111111');
  expect(page.find('.admin-badge.overdue').textContent).toMatch(/Late|Overdue/);
  expect(page.root.textContent).toContain('Late');
  expect(page.root.textContent).toContain('Met');
  expect(page.root.textContent).toContain('IST');
  page.interactive(page.find('td a'));
  page.http.verify();
});

it('keeps customer totals read-only and exposes CSV to authorized users', async () => {
  const page = await mountAdmin(AdminCustomers, { permissions: ['customers.read', 'customers.export'] });
  page.http.expectOne('/api/admin/customers?page=1').flush(onePage({
    _id: '1', name: 'Buyer', email: 'buyer@example.test', orderCount: 2,
    orderedPaise: 15000, collectedPaise: 10000, createdAt: '2026-01-01T00:00:00Z',
  }));
  await page.text('buyer@example.test');
  expect(page.find('[data-label="Orders"]').textContent?.trim()).toBe('2');
  page.interactive(page.find('a[href="/api/admin/customers/export"]'));
  page.http.expectNone({ method: 'PUT' });
  page.http.verify();
});

it('shows distinct masked newsletter rows without export controls for staff', async () => {
  const page = await mountAdmin(AdminNewsletter, { permissions: ['newsletter.read'] });
  const record = { _id: 'c•••@e•••', subscribedAt: '2026-01-01T00:00:00Z', consent: { at: '2026-01-01T00:00:00Z' } };
  page.http.expectOne('/api/admin/newsletter?page=1').flush({
    ...emptyPage, total: 2, totalPages: 1, items: [{ ...record, id: 'one' }, { ...record, id: 'two' }],
  });
  await page.text('c•••@e•••');
  expect(page.root.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(page.root.querySelector('a[href*="/export"]')).toBeNull();
  page.http.verify();
});
