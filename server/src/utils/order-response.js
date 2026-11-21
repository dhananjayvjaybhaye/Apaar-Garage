// Maps persisted orders and lines to the public CustomerOrder and OrderItem contracts.
export const customerCancellable = ['placed', 'confirmed'];

export function publicItems(items) {
  return items.map(({ slug, name, quantity, unitPricePaise }) => ({
    slug,
    name,
    quantity,
    unitPricePaise,
  }));
}

export function publicOrder(order) {
  return {
    orderNumber: order.number,
    items: publicItems(order.items),
    subtotalPaise: order.subtotalPaise,
    codFeePaise: order.codFeePaise,
    discountPaise: order.discountPaise ?? 0,
    discountCode: order.discountCode ?? null,
    shippingPaise: order.shippingPaise ?? 0,
    guest: order.guest ?? false,
    statusHistory: [{ status: 'placed', at: order.createdAt }, ...(order.statusHistory ?? [])],
    totalPaise: order.totalPaise,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt,
    deliveryEstimate: order.deliveryEstimate,
    canCancel: customerCancellable.includes(order.status),
  };
}
