import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { apiMessage } from '../api-message';
import { FieldControl, FormField } from '../ui/form-field/form-field';

export interface AdminPage<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
}

export function adminList<T>(endpoint: string) {
  const page = signal(1);
  const query = signal('');
  const resource = httpResource<AdminPage<T>>(() => {
    const params = new URLSearchParams(query());
    params.set('page', String(page()));
    return endpoint + '?' + params;
  });
  return {
    page, query, resource,
    apply(value: string) {
      if (page() === 1 && value === query()) resource.reload();
      else {
        query.set(value);
        page.set(1);
      }
    },
    error: () => apiMessage(resource.error(), 'Could not load this list.'),
  };
}

@Component({
  selector: 'app-admin-filter',
  imports: [FieldControl, FormField],
  template: `
    <form #form class="admin-box form-grid-container" (submit)="search($event, form)">
      <div class="form-grid">
        <app-form-field #field [controlId]="controlId()" [label]="label()">
          <input [appFieldControl]="field" type="search" name="q" maxlength="100" />
        </app-form-field>
        <ng-content />
      </div>
      <button type="submit" class="primary-button">Apply filters</button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFilter {
  readonly controlId = input('admin-list-search');
  readonly label = input.required<string>();
  readonly applied = output<string>();

  protected search(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim()) params.set(name, value.trim());
    }
    this.applied.emit(params.toString());
  }
}

@Component({
  selector: 'app-admin-pager',
  template: `
    @if (data(); as result) {
      <p role="status">{{ result.total }} {{ label() }}</p>
      @if (result.totalPages > 1 || result.page > 1) {
        <nav class="admin-tools admin-page-navigation" aria-label="Pages">
          <button type="button" class="secondary-button" [disabled]="result.page <= 1"
            (click)="changed.emit(result.page - 1)">Previous</button>
          <span>Page {{ result.page }} of {{ result.totalPages }}</span>
          <button type="button" class="secondary-button" [disabled]="result.page >= result.totalPages"
            (click)="changed.emit(result.page + 1)">Next</button>
        </nav>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPager {
  readonly data = input.required<AdminPage<unknown>>();
  readonly label = input('matching records');
  readonly changed = output<number>();
}
