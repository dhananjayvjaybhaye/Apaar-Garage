import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { apiMessage } from '../api-message';
import { BrandLogo } from '../ui/brand-logo';
import { AdminSessionStore } from './admin-session-store';

interface PackingSlip {
  orderNumber: string;
  createdAt: string;
  address: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: { sku?: string; name: string; quantity: number }[];
}

@Component({
  imports: [BrandLogo, DatePipe],
  template: `
    <section class="no-print">
      <h1>Orders</h1>
      <form class="admin-tools" (submit)="load($event, orderNumber.value)">
        <label for="packing-order-number">Order number</label>
        <input id="packing-order-number" #orderNumber type="text" maxlength="80" required />
        <button type="submit" class="primary-button" [disabled]="loading()">Load packing slip</button>
      </form>
      @if (loading()) { <p role="status">Loading packing slip…</p> }
      @if (error()) { <p role="alert" class="error-text">{{ error() }}</p> }
    </section>
    @if (slip(); as order) {
      <article class="print-document">
        <app-brand-logo />
        <h2>Packing slip</h2>
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
    }
  `,
  styles: `
    form, article, table { margin-block: 1rem; }
    address { font-style: normal; }
    @media print { th { position: static !important; background: white !important; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPackingSlip {
  private readonly sessions = inject(AdminSessionStore);
  protected readonly slip = signal<PackingSlip | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected async load(event: Event, value: string) {
    event.preventDefault();
    const number = value.trim();
    if (!number || this.loading()) return;
    this.loading.set(true);
    this.slip.set(null);
    this.error.set('');
    try {
      this.slip.set(await this.sessions.request<PackingSlip>(
        'GET', '/api/admin/orders/' + encodeURIComponent(number) + '/packing-slip',
      ));
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load the packing slip.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected print() {
    window.print();
  }
}
