import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiMessage } from '../api-message';
import { BrandLogo } from '../ui/brand-logo';
import { orderApi, type OrderAddress } from './orders/admin-order-types';

interface PackingSlip {
  orderNumber: string;
  createdAt: string;
  address: OrderAddress;
  items: { sku?: string; name: string; quantity: number }[];
}

@Component({
  imports: [BrandLogo, DatePipe, RouterLink],
  template: `
    <a class="secondary-button no-print" [routerLink]="['/admin/orders', number()]">Back to order</a>
    @if (slip.hasValue()) {
      @let order = slip.value();
      <article class="print-document">
        <app-brand-logo />
        <h1>Packing slip</h1>
        <p>{{ order.orderNumber }} · {{ order.createdAt | date: 'mediumDate' : '+0530' }}</p>
        <h3>Ship to</h3>
        <address>
          {{ order.address.fullName }}<br />
          {{ order.address.addressLine1 }}<br />
          @if (order.address.addressLine2; as addressLine2) { {{ addressLine2 }}<br /> }
          {{ order.address.city }}, {{ order.address.state }} {{ order.address.pincode }}
        </address>
        <table class="admin-table">
          <thead><tr><th scope="col">Item</th><th scope="col">SKU</th><th scope="col">Quantity</th></tr></thead>
          <tbody>
            @for (item of order.items; track $index) {
              <tr><td>{{ item.name }}</td><td>{{ item.sku || '—' }}</td><td>{{ item.quantity }}</td></tr>
            }
          </tbody>
        </table>
        <button class="secondary-button no-print" type="button" (click)="print()">Print packing slip</button>
      </article>
    } @else if (slip.isLoading()) {
      <p role="status">Loading packing slip…</p>
    } @else {
      <p role="alert" class="error-text">{{ loadError() }}</p>
      <button type="button" class="secondary-button" (click)="slip.reload()">Retry</button>
    }
  `,
  styles: `
    article, table { margin-block: 1rem; }
    address { font-style: normal; }
    @media print { th { position: static !important; background: white !important; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPackingSlip {
  protected readonly number = toSignal(inject(ActivatedRoute).paramMap.pipe(
    map((params) => params.get('orderNumber')),
  ));
  protected readonly slip = httpResource<PackingSlip>(() => {
    const number = this.number();
    return number ? orderApi + '/' + encodeURIComponent(number) + '/packing-slip' : undefined;
  });

  protected loadError() {
    return apiMessage(this.slip.error(), 'Could not load the packing slip.');
  }

  protected print() {
    window.print();
  }
}
