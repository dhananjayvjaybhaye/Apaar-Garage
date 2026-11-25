import { expect, it } from 'vitest';
import { emptyPage, mountAdmin, onePage, serverError } from './admin-component-fixture';
import { AdminBlockedContacts } from './blocked-contacts/admin-blocked-contacts';
import { AdminCoupons } from './coupons/admin-coupons';
import { AdminSettings } from './settings/admin-settings';

const settingsUrl = '/api/admin/settings';
const settings = {
  seller: { legalName: null, tradeName: 'Apaar Garage', state: 'Maharashtra', address: null, gstin: null },
  customerCare: {}, grievanceOfficer: {}, policyDetails: {}, gstRegistered: false,
  risk: { undeliveredLookbackDays: 90, repeatedUndeliveredAction: 'flag' },
  defaultReturnWindowDays: 7, codFeePaise: 0, codMinPaise: 200,
  codMaxPaise: null, deliveryFeePaise: 0, deliveryEstimate: 'Within a week',
  firstOrderDiscountPercent: 0, serviceablePincodeRules: [],
};

it('loads the readiness checklist, handles errors and keeps settings read-only for staff', async () => {
  const page = await mountAdmin(AdminSettings, { permissions: ['settings.read'] });
  expect(page.root.textContent).toContain('Loading store settings');
  expect(page.root.textContent).toContain('Checking launch readiness');
  page.http.expectOne(settingsUrl).flush({ message: 'Settings unavailable' }, serverError);
  page.http.expectOne(settingsUrl + '/readiness').flush({ message: 'Readiness unavailable' }, serverError);
  await page.text('Settings unavailable');
  await page.text('Readiness unavailable');
  const settingsRetry = page.button('Retry loading settings');
  page.interactive(settingsRetry);
  settingsRetry.click();
  page.http.expectOne(settingsUrl).flush(settings);
  page.button('Retry readiness check').click();
  page.http.expectOne(settingsUrl + '/readiness').flush({ blockers: [] });
  await page.text('All launch checks passed.');
  await page.text('Only store owners can edit settings.');
  const control = page.find<HTMLInputElement>('#setting-codFeePaise');
  expect(control.matches(':disabled')).toBe(true);
  expect([...page.root.querySelectorAll('button')].some((button) => button.textContent?.includes('Save settings'))).toBe(false);
  control.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  page.http.expectNone({ method: 'PUT' });
  page.http.verify();
});

it('validates settings and links server field errors to the editable control', async () => {
  const page = await mountAdmin(AdminSettings, { permissions: ['settings.read', 'settings.write'] });
  page.http.expectOne(settingsUrl).flush(settings);
  page.http.expectOne(settingsUrl + '/readiness').flush({ blockers: ['Customer care phone is missing.'] });
  await page.text('Customer care phone is missing.');
  const maximum = page.field('#setting-codMaxPaise', '1');
  page.interactive(maximum);
  const gst = page.find<HTMLInputElement>('input[name=gstRegistered]');
  gst.click();
  page.fixture.detectChanges();
  expect(page.find<HTMLInputElement>('[name="seller.gstin"]').required).toBe(true);
  expect(maximum.form!.checkValidity()).toBe(false);
  gst.click();
  page.fixture.detectChanges();
  expect(maximum.form!.checkValidity()).toBe(true);
  maximum.form!.requestSubmit(page.button('Save settings'));
  const request = page.http.expectOne({ url: settingsUrl, method: 'PUT' });
  expect(request.request.headers.get('X-Admin-CSRF')).toBe('test-csrf');
  expect(request.request.body).toMatchObject({ codMinPaise: 200, codMaxPaise: 100 });
  const message = 'The COD maximum must cover the minimum.';
  request.flush({ message, code: 'INVALID_SETTINGS', details: { issues: [{ field: 'codMaxPaise', message }] } },
    { status: 400, statusText: 'Bad request' });
  await page.text(message);
  expect(maximum.getAttribute('aria-invalid')).toBe('true');
  expect(maximum.getAttribute('aria-describedby')).toContain('setting-codMaxPaise-error');
  page.http.verify();
});

it('starts a valid coupon from a keyboard-reachable form and preserves both usage limits', async () => {
  const page = await mountAdmin(AdminCoupons);
  page.http.expectOne('/api/admin/coupons').flush(emptyPage);
  await page.text('No matching coupons.');
  const create = page.button('Create coupon');
  page.interactive(create);
  create.click();
  page.fixture.detectChanges();
  const code = page.field('#coupon-code', 'coupon');
  page.interactive(code);
  expect(code.form!.checkValidity()).toBe(false);
  page.field('#coupon-percent', '12');
  page.field('#coupon-total-limit', '10');
  page.field('#coupon-customer-limit', '2');
  expect(code.form!.checkValidity()).toBe(true);
  code.form!.requestSubmit(page.button('Save coupon'));
  const request = page.http.expectOne({ url: '/api/admin/coupons', method: 'POST' });
  expect(request.request.body).toMatchObject({ code: 'COUPON', percent: 12, totalLimit: 10, perCustomerLimit: 2 });
  request.flush({}, { status: 201, statusText: 'Created' });
  await page.verify(() => page.http.expectOne('/api/admin/coupons').flush({ items: [{
    _id: 'COUPON', percent: 12, minimumPaise: 0, active: true, totalLimit: 10, perCustomerLimit: 2, redeemedCount: 1,
  }] }));
  await page.text('1 / 10');
  page.http.verify();
});

it('requires a removal reason and sends it without exposing an unlabeled action', async () => {
  const page = await mountAdmin(AdminBlockedContacts);
  const id = '0123456789abcdef01234567';
  const endpoint = '/api/admin/blocked-contacts';
  page.http.expectOne(endpoint + '?page=1').flush(onePage({
    _id: id, pincode: '411001', reason: 'Delivery failure', createdAt: '2026-01-01T00:00:00Z',
  }));
  await page.text('Delivery failure');
  const remove = page.button('Remove');
  expect(remove.getAttribute('aria-label')).toBe('Remove block for 411001');
  page.interactive(remove);
  remove.click();
  page.fixture.detectChanges();
  const reason = page.find<HTMLInputElement>('#unblock-reason');
  expect(reason.form!.checkValidity()).toBe(false);
  page.interactive(reason);
  page.field('#unblock-reason', 'Customer checked');
  reason.form!.requestSubmit(page.button('Confirm removal'));
  const request = page.http.expectOne({ url: endpoint + '/' + id, method: 'DELETE' });
  expect(request.request.body).toEqual({ reason: 'Customer checked' });
  request.flush(null, { status: 204, statusText: 'No content' });
  await page.verify(() => page.http.expectOne(endpoint + '?page=1').flush(emptyPage));
  await page.text('0 blocked contacts');
  page.http.verify();
});
