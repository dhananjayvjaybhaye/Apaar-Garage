import { AmbientVisible } from '../motion/ambient-visible';
import { Reveal } from '../reveal';
import { Tilt } from '../motion/tilt';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { apiMessage } from '../api-message';
import { ShopState } from '../ui/shop-state';
import { OrderTotals } from './order-totals';
import { type CustomerOrder, OrdersApi } from './orders-api';

type State = { loading: boolean; order?: CustomerOrder; error?: string };

@Component({
  selector: 'app-order-success',
  imports: [AmbientVisible, Reveal, Tilt, RouterLink, OrderTotals, ShopState],
  templateUrl: './order-success.html',
  styleUrl: './order-success.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSuccess {
  private readonly api = inject(OrdersApi);
  private readonly attempt = signal(0);
  protected readonly result = toSignal(
    combineLatest([inject(ActivatedRoute).paramMap, toObservable(this.attempt)]).pipe(
      switchMap(([params]) =>
        this.api.find(params.get('orderNumber') ?? '').pipe(
          map((order): State => ({ loading: false, order })),
          catchError((error: unknown) =>
            of<State>({
              loading: false,
              error: apiMessage(error, 'The order could not be loaded.'),
            }),
          ),
          startWith<State>({ loading: true }),
        ),
      ),
    ),
    { initialValue: { loading: true } as State },
  );

  protected retry() { this.attempt.update((count) => count + 1); }
}
