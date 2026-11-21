import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { OrderSummary } from './orders-api';

@Component({
  selector: 'app-order-totals',
  imports: [CurrencyPipe],
  templateUrl: './order-totals.html',
  styles: `
    dl {
      margin: 1rem 0 0;
    }
    dl div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-block: 0.35rem;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      text-align: end;
    }
    .total {
      margin-top: 0.35rem;
      border-top: 1px solid var(--line);
      padding-top: 0.7rem;
      font-weight: 750;
    }
    .total dt {
      color: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderTotals {
  readonly summary = input.required<OrderSummary>();
}
