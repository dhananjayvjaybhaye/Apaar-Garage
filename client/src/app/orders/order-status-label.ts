import type { OrderStatus } from './orders-api';

export function orderStatusLabel(status: OrderStatus) {
  return status.replaceAll('_', ' ');
}
