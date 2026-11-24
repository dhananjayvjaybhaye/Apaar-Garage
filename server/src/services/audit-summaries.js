import { isDeepStrictEqual } from 'node:util';

export function productSummary(product) {
  const { status, stock, price, featured, placeholder } = product;
  return { status, stock, price, featured, placeholder: Boolean(placeholder) };
}

export function orderSummary(order) {
  return {
    status: order.status,
    paymentStatus: order.paymentStatus,
    confirmation: order.customerConfirmation?.status,
    trackingSet: Boolean(order.shipment?.trackingUrl),
    shipmentReferenceSet: Boolean(order.shipment?.awb),
    notesCount: order.adminNotes?.length ?? 0,
    shipmentCondition: order.shipment?.returnCondition,
    deliveryFailure: order.shipment?.undeliveredReason,
  };
}

export function returnSummary(request) {
  return {
    status: request.status,
    refundAmountPaise: request.refundAmountPaise,
    itemConditions: request.items.map(({ condition, quantity }) => ({ condition, quantity })),
  };
}

const privateSettingGroups = new Set([
  'seller',
  'grievanceOfficer',
  'customerCare',
  'policyDetails',
]);

export function settingsChanges(previous, next) {
  const before = {};
  const after = {};
  for (const [group, value] of Object.entries(next)) {
    const old = previous[group];
    if (isDeepStrictEqual(old, value)) continue;
    if (privateSettingGroups.has(group)) {
      for (const [key, current] of Object.entries(value)) {
        if (current === old?.[key]) continue;
        before[group + '.' + key] = old?.[key] ? 'configured' : 'unset';
        after[group + '.' + key] = current ? 'configured' : 'unset';
      }
    } else if (group === 'serviceablePincodeRules') {
      before[group] = { count: old?.length ?? 0 };
      after[group] = { count: value.length };
    } else {
      before[group] = old;
      after[group] = value;
    }
  }
  return { before, after };
}
