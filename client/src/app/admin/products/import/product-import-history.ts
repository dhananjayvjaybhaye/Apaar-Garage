import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { ProductImportApi } from './product-import-api';

@Component({
  selector: 'app-product-import-history',
  imports: [DatePipe, RouterLink],
  styleUrl: './product-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <header class="admin-header">
        <div>
          <a routerLink="/admin/product-import">Import products</a>
          <h1>Import history</h1>
        </div>
      </header>
      @if (history.isLoading()) {
        <p role="status">Loading import history…</p>
      } @else if (history.error()) {
        <p class="error-text" role="alert">Could not load import history.</p>
        <button class="secondary-button" type="button" (click)="history.reload()">Retry</button>
      } @else if (history.hasValue() && history.value().length) {
        <div
          class="admin-table-wrap"
          tabindex="0"
          role="region"
          aria-label="Recent product imports"
        >
          <table class="admin-table import-table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Admin</th>
                <th scope="col">Time</th>
                <th scope="col">Mode</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of history.value(); track entry.id) {
                <tr>
                  <td>{{ entry.file }}</td>
                  <td>{{ entry.actor }}</td>
                  <td>{{ entry.at | date: 'medium' }}</td>
                  <td>{{ entry.mode === 'upsert' ? 'Create and update' : 'Create only' }}</td>
                  <td>
                    {{ entry.counts.create }} created · {{ entry.counts.update }} updated ·
                    {{ entry.counts.unchanged }} unchanged · {{ entry.counts.error }} with errors
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p>No confirmed imports yet.</p>
      }
    </main>
  `,
})
export class ProductImportHistory {
  private readonly api = inject(ProductImportApi);
  protected readonly history = rxResource({ stream: () => from(this.api.history()) });
}
