import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StockWatch } from './stock-watch';

@Component({
  selector: 'app-stock-notices',
  imports: [RouterLink],
  template: `
    @if (watch.restocked().length) {
      <aside class="container notices" aria-label="Stock alerts">
        <ul>
          @for (product of watch.restocked(); track product.slug) {
            <li>
              <p role="status"><a [routerLink]="['/product', product.slug]">{{ product.name }}</a> is back in stock.</p>
              <button type="button" class="secondary-button" [attr.aria-label]="'Dismiss stock alert for ' + product.name" (click)="watch.dismiss(product.slug)">Dismiss</button>
            </li>
          }
        </ul>
      </aside>
    }
  `,
  styles: `
    ul { margin:.75rem 0; padding:0; list-style:none; }
    li { display:flex; justify-content:space-between; align-items:center; gap:.75rem; padding:.55rem .75rem; border:1px solid var(--line); border-radius:var(--radius); background:var(--panel); }
    li + li { margin-top:.35rem; }
    p { margin:0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockNotices {
  protected readonly watch = inject(StockWatch);
}
