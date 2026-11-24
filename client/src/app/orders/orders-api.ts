import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export type SavedAddress = ShippingAddress & { id: string };

export interface OrderItem {
  slug: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
}

export interface OrderSummary {
  items: OrderItem[];
  subtotalPaise: number;
  codFeePaise: number;
  discountPaise?: number;
  discountCode?: string | null;
  shippingPaise: number;
  totalPaise: number;
  taxPaise?: number | null;
  deliveryEstimate: string;
}

export interface OrderQuote extends OrderSummary {
  quote: string;
  emailUpdates?: boolean;
  firstOrderPercent?: number;
  paymentMethod: 'cod';
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'undelivered'
  | 'returned_to_seller'
  | 'cancelled'
  | 'returned';

export interface CustomerOrder extends OrderSummary {
  orderNumber: string;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'collected' | 'failed';
  status: OrderStatus;
  invoiceNumber?: string;
  shipment?: { courier?: string; awb?: string; trackingUrl?: string };
  createdAt: string;
  canCancel: boolean;
  guest: boolean;
  statusHistory: { status: CustomerOrder['status']; at: string }[];
}

export interface OrderPage {
  items: CustomerOrder[];
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  place(
    address: ShippingAddress,
    quote: string,
    checkoutKey: string,
    options: { acceptPolicies: true; saveAddress?: boolean; coupon?: string; email?: string },
  ) {
    return this.http.post<{ orderNumber: string }>('/api/orders', {
      address,
      quote,
      checkoutKey,
      ...options,
      paymentMethod: 'cod',
    });
  }

  history(page: number) {
    return this.http.get<OrderPage>('/api/orders', { params: { page } });
  }

  find(orderNumber: string) {
    return this.http.get<CustomerOrder>(this.url(orderNumber));
  }

  cancel(orderNumber: string) {
    return this.http.post<CustomerOrder>(this.url(orderNumber) + '/cancel', {});
  }

  private url(orderNumber: string) {
    return '/api/orders/' + encodeURIComponent(orderNumber);
  }
}
