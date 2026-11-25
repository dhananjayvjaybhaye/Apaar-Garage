import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../api-message';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { paisePerRupee } from '../admin.config';
import { AdminSessionStore } from '../admin-session-store';
import { orderApi, orderLabel, orderStatuses, type OrderSummary } from './admin-order-types';

interface OrdersPage {
  items: OrderSummary[];
  total: number;
  page: number;
  totalPages: number;
}

@Component({
  imports: [CurrencyPipe, DatePipe, NgTemplateOutlet, RouterLink, FieldControl, FormField],
  templateUrl: './admin-order-list.html',
  styleUrl: './admin-order-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderList {
  private readonly sessions = inject(AdminSessionStore);
  private query = '';
  protected readonly data = signal<OrdersPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly exportUrl = signal(orderApi + '/export');
  protected readonly label = orderLabel;
  protected readonly statuses = orderStatuses;
  protected readonly paise = paisePerRupee;

  constructor() {
    void this.load(1);
  }

  protected apply(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim()) query.set(name, value.trim());
    }
    this.query = query.toString();
    void this.load(1);
  }

  protected async load(page: number) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const query = new URLSearchParams(this.query);
    this.exportUrl.set(orderApi + '/export?' + query);
    query.set('page', String(page));
    try {
      this.data.set(await this.sessions.request<OrdersPage>('GET', orderApi + '?' + query));
    } catch (error) {
      this.data.set(null);
      this.error.set(apiMessage(error, 'Could not load orders.'));
    } finally {
      this.loading.set(false);
    }
  }
}
