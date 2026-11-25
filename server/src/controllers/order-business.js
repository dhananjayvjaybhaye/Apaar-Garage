import { adminAudit } from '../services/audit.js';
import { z } from 'zod';
import { customerInvoice } from '../services/invoices.js';
import { findCustomerOrder, ownedOrderFilter } from '../services/order-history.js';
import { updateOrderAdministration } from '../services/order-status.js';
import { changeReturn, listReturns, publicReturn, requestReturn } from '../services/returns.js';
import {
  confirmationInput,
  note,
  orderNumberPattern,
  returnId,
  returnInput,
  returnTransition,
} from '../utils/order-business-input.js';
import { validate } from '../utils/http-error.js';
import { publicOrder } from '../utils/order-response.js';
import { orderActions } from '../services/order-confirmation.js';

const noteInput = z.strictObject({ note });
const orderNumber = (req) => validate(orderNumberPattern, req.params.orderNumber);
const owned = (req, res) => ownedOrderFilter(orderNumber(req), res.locals.shopper);

export const orderBusiness = {
  async invoice(req, res) {
    res.json(await customerInvoice(owned(req, res)));
  },
  async returns(req, res) {
    res.json({ items: (await listReturns(owned(req, res))).map(publicReturn) });
  },
  async requestReturn(req, res) {
    const input = validate(returnInput, req.body);
    const request = await requestReturn(owned(req, res), input, res.locals.shopper.id, req.ip);
    res.status(201).json(publicReturn(request));
  },
  async adminDetail(req, res, settings) {
    const order = await findCustomerOrder({ number: orderNumber(req) });
    const { risk } = await settings.read();
    res.json({
      ...publicOrder(order),
      address: order.address,
      items: order.items.map(({ slug, sku, name, quantity, unitPricePaise, discountPaise }) => ({
        slug, sku, name, quantity, unitPricePaise, discountPaise,
      })),
      taxBreakup: order.taxBreakup,
      invoiceType: order.invoiceType,
      actions: orderActions(order, risk),
      adminNotes: order.adminNotes,
      customerConfirmation: order.customerConfirmation,
      shipment: order.shipment,
      risk: { flags: order.risk?.flags ?? [] },
      needsConfirmation: order.needsConfirmation ?? false,
      cancellation: order.cancellation,
    });
  },
  async adminInvoice(req, res) {
    res.json(await customerInvoice({ number: orderNumber(req) }));
  },
  async packingSlip(req, res) {
    const order = await findCustomerOrder({ number: orderNumber(req) });
    const { fullName, addressLine1, addressLine2, city, state, pincode } = order.address;
    res.json({
      orderNumber: order.number,
      createdAt: order.createdAt,
      address: { fullName, addressLine1, addressLine2, city, state, pincode },
      items: order.items.map(({ sku, name, quantity }) => ({ sku, name, quantity })),
    });
  },
  async adminReturns(req, res) {
    res.json({ items: await listReturns({ number: orderNumber(req) }) });
  },
  async changeReturn(req, res) {
    const result = await changeReturn(
      orderNumber(req),
      validate(returnId, req.params.id),
      validate(returnTransition, req.body),
      adminAudit(req, res),
    );
    res.json(result);
  },
  async addNote(req, res) {
    const { note } = validate(noteInput, req.body);
    const order = await updateOrderAdministration(
      orderNumber(req),
      {
        $push: { adminNotes: { note, by: res.locals.user._id, at: new Date() } },
      },
      adminAudit(req, res),
      'order.note_added',
    );
    res.status(201).json({ adminNotes: order.adminNotes });
  },
  async confirm(req, res) {
    const { status } = validate(confirmationInput, req.body);
    const order = await updateOrderAdministration(
      orderNumber(req),
      {
        $set: { customerConfirmation: { status, by: res.locals.user._id, at: new Date() } },
      },
      adminAudit(req, res),
      'order.confirmation_changed',
    );
    res.json({ customerConfirmation: order.customerConfirmation });
  },
};
