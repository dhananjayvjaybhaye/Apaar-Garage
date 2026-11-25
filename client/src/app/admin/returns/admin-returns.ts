import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { AdminFilter, AdminPager, adminList } from '../admin-list';
import { orderLabel } from '../orders/admin-order-types';

export interface ReturnSummary {
  _id: string;
  orderNumber: string;
  reason: string;
  status: string;
  createdAt: string;
  maximumRefundPaise?: number;
}

@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink, FieldControl, FormField, AdminFilter, AdminPager],
  templateUrl: './admin-returns.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReturns {
  protected readonly list = adminList<ReturnSummary>('/api/admin/returns');
  protected readonly label = orderLabel;
  protected readonly statuses = ['requested', 'approved', 'received', 'refunded', 'replaced', 'rejected'];
}
