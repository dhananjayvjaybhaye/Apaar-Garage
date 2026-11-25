import { expect, it } from 'vitest';
import { mountAdmin } from './admin-component-fixture';
import { AdminOrderDetail } from './orders/admin-order-detail';
import { AdminReturnDetail } from './returns/admin-return-detail';
import { AdminTicketDetail } from './support/admin-ticket-detail';

const orderNumber = 'AG-0123456789ABCD';
const orderUrl = '/api/admin/orders/' + orderNumber;
const orderParams = { params: { orderNumber }, permissions: ['orders.work'] };
const notFound = { status: 404, statusText: 'Not found' };
const order = {
  orderNumber, items: [], risk: { flags: ['high_value'] }, address: { fullName: 'Buyer', phone: '9876543210' },
  subtotalPaise: 1000, totalPaise: 1000, codFeePaise: 0, shippingPaise: 0,
  paymentMethod: 'cod', paymentStatus: 'pending', status: 'confirmed', statusHistory: [],
  customerConfirmation: { status: 'pending' },
  actions: { statuses: ['cancelled'], confirmationBlocked: true, collectCod: false },
};

it('shows only allowed order actions, submits confirmation and then enables Pack', async () => {
  const page = await mountAdmin(AdminOrderDetail, orderParams);
  expect(page.root.textContent).toContain('Loading order');
  page.http.expectOne(orderUrl).flush(order);
  await page.text('Confirm the order with the customer before packing.');
  const captions = () => [...page.root.querySelectorAll('button')].map((button) => button.textContent?.trim());
  expect(captions()).toContain('Cancel order');
  expect(captions()).not.toContain('Pack');
  for (const invalid of ['Mark shipped', 'Mark delivered', 'Mark COD collected']) expect(captions()).not.toContain(invalid);
  for (const label of ['Unreachable', 'Declined', 'Confirmed']) page.interactive(page.button(label));
  page.button('Confirmed').click();
  const request = page.http.expectOne({ url: orderUrl + '/confirmation', method: 'PATCH' });
  expect(request.request.body).toEqual({ status: 'confirmed' });
  request.flush({});
  await page.verify(() => {
    const read = page.http.expectOne(orderUrl);
    read.flush({ ...order, customerConfirmation: { status: 'confirmed' },
      actions: { statuses: ['packed', 'cancelled'], confirmationBlocked: false, collectCod: false } });
  });
  await page.text('Pack');
  expect(page.button('Confirmed').disabled).toBe(true);
  page.interactive(page.button('Pack'));
  page.http.verify();
});

it('checks the shipment URL before sending and includes courier and tracking fields', async () => {
  const page = await mountAdmin(AdminOrderDetail, orderParams);
  page.http.expectOne(orderUrl).flush({ ...order, status: 'packed',
    actions: { statuses: ['shipped', 'cancelled'], confirmationBlocked: false, collectCod: false } });
  await page.text('Shipment');
  const tracking = page.field('#order-tracking-url', 'javascript:alert(1)');
  page.interactive(tracking);
  expect(tracking.form!.checkValidity()).toBe(false);
  tracking.form!.requestSubmit(page.button('Mark shipped'));
  page.http.expectNone({ method: 'PATCH' });
  page.field('#order-courier', 'Test courier');
  page.field('#order-awb', 'AWB123');
  page.field('#order-tracking-url', 'https://example.test/track');
  expect(tracking.form!.checkValidity()).toBe(true);
  tracking.form!.requestSubmit(page.button('Mark shipped'));
  const request = page.http.expectOne({ url: orderUrl + '/status', method: 'PATCH' });
  expect(request.request.body).toEqual({
    status: 'shipped', shipment: { courier: 'Test courier', awb: 'AWB123', trackingUrl: 'https://example.test/track' },
  });
  request.flush({});
  await page.verify(() => page.http.expectOne(orderUrl).flush({ ...order, status: 'shipped',
    actions: { statuses: ['delivered', 'undelivered'], confirmationBlocked: false, collectCod: false } }));
  await page.text('Mark delivered');
  expect(page.root.querySelector('#order-tracking-url')).toBeNull();
  page.http.verify();
});

it('shows a keyboard-reachable retry for a missing order', async () => {
  const page = await mountAdmin(AdminOrderDetail, orderParams);
  page.http.expectOne(orderUrl).flush({ message: 'Order not found.' }, notFound);
  await page.text('Order not found.');
  page.interactive(page.button('Retry'));
  page.http.verify();
});

it('requires each return condition and submits it without offering a premature refund', async () => {
  const id = '0123456789abcdef01234567';
  const url = '/api/admin/returns/' + id;
  const page = await mountAdmin(AdminReturnDetail, { params: { id } });
  expect(page.root.textContent).toContain('Loading return');
  const entry = { _id: id, orderNumber, status: 'approved', reason: 'defective', actions: ['received', 'rejected'],
    items: [{ slug: 'car', name: 'Car', quantity: 1 }], paymentCollected: false, maximumRefundPaise: 100 };
  page.http.expectOne(url).flush(entry);
  await page.text('Mark received');
  expect(page.root.textContent).not.toContain('Record refund');
  const select = page.field('#return-action', 'received', 'change');
  page.interactive(page.find('#return-condition-car'));
  expect(select.form!.checkValidity()).toBe(false);
  page.field('#return-condition-car', 'damaged', 'change');
  select.form!.requestSubmit(page.button('Save return'));
  const update = page.http.expectOne({ method: 'PATCH', url: orderUrl + '/returns/' + id });
  expect(update.request.body).toEqual({ status: 'received', items: [{ slug: 'car', condition: 'damaged' }] });
  update.flush({});
  await page.verify(() => page.http.expectOne(url).flush({ ...entry, status: 'received', actions: ['replaced'] }));
  await page.text('Record payment on the order before refunding.');
  page.http.verify();
});

it('shows the ticket thread and deadlines and hides controls once closed', async () => {
  const ticketNumber = 'AGT-1111111111111111';
  const url = '/api/admin/support/' + ticketNumber;
  const page = await mountAdmin(AdminTicketDetail, { params: { ticketNumber } });
  expect(page.root.textContent).toContain('Loading ticket');
  const ticket = {
    ticketNumber, status: 'open', createdAt: '2000-01-01T00:00:00Z', acknowledgeBy: '2000-01-03T00:00:00Z',
    dueAt: '2000-01-31T00:00:00Z', message: 'My parcel is late', replies: [],
    actions: { nextStatus: 'acknowledged', canReply: true },
  };
  page.http.expectOne(url).flush(ticket);
  await page.text('My parcel is late');
  expect(page.root.textContent).toContain('Overdue');
  page.interactive(page.button('Acknowledge ticket'));
  const reply = page.field('#support-reply', 'An update');
  page.interactive(reply);
  reply.form!.requestSubmit(page.button('Add reply'));
  const request = page.http.expectOne({ method: 'PATCH', url });
  expect(request.request.body).toEqual({ reply: 'An update' });
  request.flush({});
  await page.verify(() => page.http.expectOne(url).flush({ ...ticket, status: 'closed',
    replies: [{ from: 'support', message: 'An update', at: '2000-02-01T00:00:00Z' }],
    actions: { canReply: false } }));
  await page.text('An update');
  expect(page.root.querySelector('#support-reply')).toBeNull();
  page.http.verify();
});
