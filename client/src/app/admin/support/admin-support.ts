import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { AdminFilter, AdminPager, adminList } from '../admin-list';
import { orderLabel } from '../orders/admin-order-types';
import { AdminDeadline, deadlineClock } from './admin-deadline';

export interface TicketSummary {
  _id: string;
  ticketNumber?: string;
  name?: string;
  email: string;
  category?: string;
  status: string;
  createdAt: string;
  acknowledgeBy?: string;
  acknowledgedAt?: string;
  dueAt?: string;
  resolvedAt?: string;
}

@Component({
  imports: [RouterLink, FieldControl, FormField, AdminFilter, AdminPager, AdminDeadline],
  templateUrl: './admin-support.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSupport {
  protected readonly list = adminList<TicketSummary>('/api/admin/support');
  protected readonly now = deadlineClock();
  protected readonly label = orderLabel;
  protected readonly statuses = ['open', 'acknowledged', 'resolved', 'closed'];
}
