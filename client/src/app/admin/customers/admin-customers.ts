import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminFilter, AdminPager, adminList } from '../admin-list';

interface CustomerSummary {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  orderCount: number;
  orderedPaise: number;
  collectedPaise: number;
}

@Component({
  imports: [CurrencyPipe, DatePipe, AdminFilter, AdminPager],
  template: `
    <main>
      <header class="admin-header"><h1>Customers</h1></header>
      <p class="muted">Registered accounts. Order value excludes cancelled orders. Collected totals are before refunds.</p>
      <app-admin-filter label="Search by name or email" (applied)="list.apply($event)" />
      @if (list.resource.isLoading()) { <p role="status">Loading customers…</p> }
      @else if (list.resource.hasValue()) {
        @let data = list.resource.value();
        @if (data.items.length) {
          <div class="admin-table-wrap admin-list"><table class="admin-table" role="table">
            <thead><tr><th scope="col">Customer</th><th scope="col">Email</th><th scope="col">Joined (IST)</th>
              <th scope="col">Orders</th><th scope="col">Order value</th><th scope="col">Collected</th></tr></thead>
            <tbody>
              @for (customer of data.items; track customer._id) {
                <tr>
                  <td data-label="Customer">{{ customer.name }}</td><td data-label="Email">{{ customer.email }}</td>
                  <td data-label="Joined">{{ customer.createdAt | date: 'mediumDate' : '+0530' }}</td>
                  <td data-label="Orders">{{ customer.orderCount }}</td>
                  <td data-label="Order value">{{ customer.orderedPaise / 100 | currency: 'INR' }}</td>
                  <td data-label="Collected">{{ customer.collectedPaise / 100 | currency: 'INR' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
        <app-admin-pager [data]="data" label="matching customers" (changed)="list.page.set($event)" />
      } @else {
        <p role="alert" class="error-text">{{ list.error() }}</p>
        <button type="button" class="secondary-button" (click)="list.resource.reload()">Retry</button>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCustomers {
  protected readonly list = adminList<CustomerSummary>('/api/admin/customers');
}
