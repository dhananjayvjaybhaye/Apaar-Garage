import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiMessage } from '../../api-message';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { adminAction } from '../admin-action';
import { rupeesPattern, rupeesToPaise } from '../admin-money';
import { orderApi, orderLabel } from '../orders/admin-order-types';
import type { ReturnSummary } from './admin-returns';

export type ReturnAction = 'approved' | 'rejected' | 'received' | 'refunded' | 'replaced';

interface ReturnDetail extends ReturnSummary {
  items: { slug: string; name?: string; quantity: number; condition?: string }[];
  notes?: { note: string; at: string; internal?: boolean }[];
  actions: ReturnAction[];
  paymentCollected: boolean;
  refundAmountPaise?: number;
  refundLimitPaise: number;
  receivedAt?: string;
  resolvedAt?: string;
}

@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink, FieldControl, FormField],
  templateUrl: './admin-return-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReturnDetail {
  protected readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))));
  protected readonly resource = httpResource<ReturnDetail>(() => {
    const id = this.id();
    return id ? '/api/admin/returns/' + encodeURIComponent(id) : undefined;
  });
  protected readonly action = adminAction();
  protected readonly selected = signal<ReturnAction | ''>('');
  protected readonly label = orderLabel;
  protected readonly moneyPattern = rupeesPattern;
  protected readonly actionLabels = {
    approved: 'Approve return', rejected: 'Reject return', received: 'Mark received',
    refunded: 'Record refund', replaced: 'Record replacement',
  };

  protected error() {
    return apiMessage(this.resource.error(), 'Could not load this return.');
  }

  protected choose(value: string, entry: ReturnDetail) {
    this.selected.set(entry.actions.find((status) => status === value) ?? '');
  }

  protected save(event: Event, form: HTMLFormElement, entry: ReturnDetail) {
    event.preventDefault();
    const status = this.selected();
    if (!status || !entry.actions.includes(status)) return;
    const fields = new FormData(form);
    const note = String(fields.get('note') ?? '').trim();
    const body = {
      status, ...(note && { note }),
      ...(status === 'received' && { items: entry.items.map(({ slug }) => ({
        slug, condition: fields.get('condition-' + slug),
      })) }),
      ...(status === 'refunded' && { refundAmountPaise: rupeesToPaise(String(fields.get('amount'))) }),
    };
    const path = orderApi + '/' + encodeURIComponent(entry.orderNumber) + '/returns/' + encodeURIComponent(entry._id);
    void this.action.run('PATCH', path, body, 'Return updated.', () => {
      this.selected.set('');
      form.reset();
      this.resource.reload();
    });
  }
}
