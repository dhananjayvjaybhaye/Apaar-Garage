import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { AdminFilter, AdminPager, adminList } from '../admin-list';

interface Subscriber {
  _id: string;
  subscribedAt: string;
  unsubscribedAt?: string;
  consent?: { at?: string; textVersion?: string; source?: string };
}

const endpoint = '/api/admin/newsletter';

@Component({
  imports: [DatePipe, FieldControl, FormField, AdminFilter, AdminPager],
  template: `
    <main>
      <header class="admin-header">
        <h1>Newsletter</h1>
        @if (list.resource.hasValue()) {
          <a class="secondary-button" [href]="exportUrl()">Export active subscribers (CSV)</a>
        }
      </header>
      <app-admin-filter label="Search by email" (applied)="list.apply($event)">
        <app-form-field #field controlId="subscriber-status" label="Subscription status">
          <select name="status" [appFieldControl]="field">
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="all">All records</option>
          </select>
        </app-form-field>
      </app-admin-filter>
      @if (list.resource.isLoading()) { <p role="status">Loading subscribers…</p> }
      @else if (list.resource.hasValue()) {
        @let data = list.resource.value();
        @if (data.items.length) {
          <div class="admin-table-wrap admin-list"><table class="admin-table" role="table">
            <thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Subscribed (IST)</th>
              <th scope="col">Consent</th><th scope="col">Source</th></tr></thead>
            <tbody>
              @for (subscriber of data.items; track subscriber._id) {
                <tr>
                  <td data-label="Email">{{ subscriber._id }}</td>
                  <td data-label="Status"><div><span class="admin-badge">{{ subscriber.unsubscribedAt
                    ? 'Unsubscribed' : subscriber.consent?.at ? 'Subscribed' : 'Consent missing' }}</span>
                    @if (subscriber.unsubscribedAt) { <div>{{ subscriber.unsubscribedAt | date: 'mediumDate' : '+0530' }}</div> }
                  </div></td>
                  <td data-label="Subscribed">{{ subscriber.subscribedAt | date: 'mediumDate' : '+0530' }}</td>
                  <td data-label="Consent"><div>{{ subscriber.consent?.textVersion || '—' }}
                    @if (subscriber.consent?.at) { <div>{{ subscriber.consent?.at | date: 'mediumDate' : '+0530' }}</div> }
                  </div></td>
                  <td data-label="Source">{{ subscriber.consent?.source || '—' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
        <app-admin-pager [data]="data" label="matching subscription records" (changed)="list.page.set($event)" />
      } @else {
        <p role="alert" class="error-text">{{ list.error() }}</p>
        <button type="button" class="secondary-button" (click)="list.resource.reload()">Retry</button>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNewsletter {
  protected readonly list = adminList<Subscriber>(endpoint);
  protected readonly exportUrl = computed(() => {
    const search = new URLSearchParams(this.list.query()).get('q');
    return endpoint + '/export' + (search ? '?q=' + encodeURIComponent(search) : '');
  });
}
