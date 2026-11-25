import { adminCancellable, orderTransitions } from '../config/business.js';

const openStates = ['placed', 'confirmed'];

export function needsCustomerConfirmation(order, risk) {
  return order.customerConfirmation?.status !== 'confirmed' &&
    Boolean(order.needsConfirmation || order.risk?.flags?.length ||
      (risk.confirmationAbovePaise !== null && order.totalPaise > risk.confirmationAbovePaise));
}

export function orderActions(order, risk) {
  const confirmationBlocked = openStates.includes(order.status) && needsCustomerConfirmation(order, risk);
  const statuses = (orderTransitions[order.status] ?? []).filter(
    (status) => status !== 'packed' || !confirmationBlocked,
  );
  if (adminCancellable.includes(order.status)) statuses.push('cancelled');
  return {
    statuses,
    confirmationBlocked,
    collectCod: order.status === 'delivered' && order.paymentMethod === 'cod' &&
      order.paymentStatus !== 'collected',
  };
}

export function confirmationQueue(risk) {
  return {
    status: { $in: openStates },
    'customerConfirmation.status': { $ne: 'confirmed' },
    $or: [
      { needsConfirmation: true },
      { 'risk.flags.0': { $exists: true } },
      ...(risk.confirmationAbovePaise === null ? [] : [
        { totalPaise: { $gt: risk.confirmationAbovePaise } },
      ]),
    ],
  };
}
