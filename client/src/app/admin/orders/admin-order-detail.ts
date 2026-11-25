import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiMessage } from '../../api-message';
import { paisePerRupee } from '../admin.config';
import { AdminSessionStore } from '../admin-session-store';
import { AdminOrderActions, type OrderCommand } from './admin-order-actions';
import { orderApi, orderLabel, type AdminOrder } from './admin-order-types';

@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink, AdminOrderActions],
  templateUrl: './admin-order-detail.html',
  styleUrl: './admin-order-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderDetail {
  private readonly sessions = inject(AdminSessionStore);
  protected readonly number = toSignal(inject(ActivatedRoute).paramMap.pipe(
    map((params) => params.get('orderNumber')),
  ));
  private readonly url = computed(() => {
    const number = this.number();
    return number ? orderApi + '/' + encodeURIComponent(number) : undefined;
  });
  protected readonly resource = httpResource<AdminOrder>(this.url);
  protected readonly busy = signal(false);
  protected readonly feedback = signal<
    { number: string | null; message: string; error: boolean } | undefined
  >(undefined);
  protected readonly message = computed(() => {
    const feedback = this.feedback();
    return feedback?.number === this.number() ? feedback : undefined;
  });
  protected readonly label = orderLabel;
  protected readonly paise = paisePerRupee;

  protected loadError() {
    return apiMessage(this.resource.error(), 'Could not load the order.');
  }

  protected async update({ path, body, onSuccess }: OrderCommand) {
    const url = this.url();
    if (!url || this.busy() || this.resource.isLoading()) return;
    const number = this.number() ?? null;
    this.busy.set(true);
    this.feedback.set(undefined);
    try {
      await this.sessions.request(path === 'notes' ? 'POST' : 'PATCH', url + '/' + path, body);
      onSuccess?.();
      this.feedback.set({ number, message: path === 'notes' ? 'Note added.' : 'Order updated.', error: false });
    } catch (error) {
      this.feedback.set({ number, message: apiMessage(error, 'Could not update the order.'), error: true });
    } finally {
      if (this.url() === url) this.resource.reload();
      this.busy.set(false);
    }
  }

  protected trackingLink(url?: string) {
    return url && /^https?:\/\//i.test(url) ? url : undefined;
  }
}
