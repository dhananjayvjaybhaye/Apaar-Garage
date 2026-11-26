import { TestBed } from '@angular/core/testing';
import { expect, test } from 'vitest';
import { AdminNoAccess } from './admin-access-pages';
import { mountAdmin } from './admin-component-fixture';
import { AdminDashboard } from './admin-dashboard';
import { AdminSessionStore } from './admin-session-store';

test('explains the missing permission and links to usable sections', async () => {
  const page = await mountAdmin(AdminNoAccess, {
    query: { permission: 'customers.read' },
    permissions: ['dashboard.read', 'orders.work'],
  });
  await page.text('Missing permission Open Customers.');
  const sections = [...page.root.querySelectorAll('li a')];
  expect(sections.map((link) => link.textContent)).toEqual(['Dashboard', 'Orders']);
  expect(sections[1].getAttribute('href')).toBe('/admin/orders');
  page.interactive(page.find('li a'));
});

test.each([undefined, []])('warns when the session does not supply permissions (%j)', async (permissions) => {
  const page = await mountAdmin(AdminNoAccess, { permissions });
  expect(page.find('[role="alert"]').textContent).toBe('The admin server is out of date. Restart it.');
  expect(page.root.querySelector('a')).toBeNull();
});

test.each([false, true])('only lists the administrator screen when staff exists (%s)', async (hasStaff) => {
  await mountAdmin(AdminNoAccess, { permissions: ['dashboard.read', 'admin-users.manage'], hasStaff });
  const sections = TestBed.inject(AdminSessionStore).sections();
  expect(sections.some(({ permission }) => permission === 'admin-users.manage')).toBe(hasStaff);
});

test('shows the recovery alert until an owner exists', async () => {
  const page = await mountAdmin(AdminDashboard, { permissions: ['dashboard.read'] });
  const metrics = { counts: {}, sales: [{ date: '2026-11-26', totalPaise: 0 }], topSellers: [] };
  page.http.expectOne('/api/admin/overview/dashboard').flush({
    ...metrics,
    ownerWarning: 'No store owner found. Run `npm run migrate-admin-access` or `npm run create-admin -- --owner`.',
  });
  await page.text('No store owner found. Run npm run migrate-admin-access or npm run create-admin -- --owner.');
  expect(page.find('[role="alert"]')).toBeTruthy();
  page.button('Refresh').click();
  page.http.expectOne('/api/admin/overview/dashboard').flush(metrics);
  await page.verify(() => expect(page.root.querySelector('[role="alert"]')).toBeNull());
});
