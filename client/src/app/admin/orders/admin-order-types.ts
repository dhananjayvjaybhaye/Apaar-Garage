import type { CustomerOrder } from '../../orders/orders-api';

export const orderApi = '/api/admin/orders';
export const orderStatuses = [
  'placed', 'confirmed', 'packed', 'shipped', 'delivered', 'undelivered', 'returned_to_seller',
  'cancelled', 'returned',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type ConfirmationStatus = 'pending' | 'confirmed' | 'unreachable' | 'declined';

export function orderLabel(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1).replaceAll('_', ' ') : '';
}

export interface OrderAddress {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface OrderSummary {
  orderNumber: string;
  createdAt: string;
  customer?: string;
  phone?: string;
  pincode?: string;
  status: OrderStatus;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'collected' | 'failed';
  totalPaise: number;
  flagged: boolean;
  needsConfirmation: boolean;
}

export interface AdminOrder extends Omit<CustomerOrder, 'items' | 'shipment'> {
  address?: OrderAddress;
  items: (CustomerOrder['items'][number] & { sku?: string; discountPaise?: number })[];
  invoiceType?: 'tax_invoice' | 'bill_of_supply';
  taxBreakup?: {
    gstRatePercent: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
  }[];
  shipment?: NonNullable<CustomerOrder['shipment']> & {
    undeliveredReason?: string;
    undeliveredNote?: string;
    returnCondition?: string;
  };
  risk: { flags: string[] };
  customerConfirmation?: { status: ConfirmationStatus; at?: string };
  adminNotes?: { note: string; at: string }[];
  cancellation?: { reasonCode: string; note?: string; at: string };
  actions: { statuses: OrderStatus[]; confirmationBlocked: boolean; collectCod: boolean };
}
