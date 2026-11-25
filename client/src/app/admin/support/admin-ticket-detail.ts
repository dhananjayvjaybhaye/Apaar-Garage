import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiMessage } from '../../api-message';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { adminAction } from '../admin-action';
import { orderLabel } from '../orders/admin-order-types';
import { AdminDeadline, deadlineClock } from './admin-deadline';
import type { TicketSummary } from './admin-support';

type NextStatus = 'acknowledged' | 'resolved' | 'closed';

interface TicketDetail extends TicketSummary {
  phone?: string;
  orderNumber?: string;
  message: string;
  replies: { from: 'customer' | 'support'; message: string; at: string }[];
  actions: { nextStatus?: NextStatus; canReply: boolean };
}

@Component({
  imports: [DatePipe, RouterLink, FieldControl, FormField, AdminDeadline],
  templateUrl: './admin-ticket-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTicketDetail {
  private readonly number = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('ticketNumber'))));
  protected readonly resource = httpResource<TicketDetail>(() => {
    const number = this.number();
    return number ? '/api/admin/support/' + encodeURIComponent(number) : undefined;
  });
  protected readonly action = adminAction();
  protected readonly now = deadlineClock();
  protected readonly label = orderLabel;
  protected readonly transitions = {
    acknowledged: 'Acknowledge ticket', resolved: 'Mark resolved', closed: 'Close ticket',
  };

  protected error() {
    return apiMessage(this.resource.error(), 'Could not load the ticket.');
  }

  protected update(body: { status: NextStatus } | { reply: string }, onSuccess?: () => void) {
    const number = this.number();
    if (!number || this.resource.isLoading()) return;
    void this.action.run('PATCH', '/api/admin/support/' + encodeURIComponent(number), body,
      'reply' in body ? 'Reply added.' : 'Ticket updated.', () => {
        onSuccess?.();
        this.resource.reload();
      });
  }

  protected reply(event: Event, field: HTMLTextAreaElement) {
    event.preventDefault();
    this.update({ reply: field.value.trim() }, () => { field.value = ''; });
  }
}
