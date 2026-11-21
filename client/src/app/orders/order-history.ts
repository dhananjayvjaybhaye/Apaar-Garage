import { AmbientVisible } from '../motion/ambient-visible';
import { Tilt } from '../motion/tilt';
import { Reveal } from '../reveal';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { apiMessage } from '../api-message';
import { ShopState } from '../ui/shop-state';
import { OrdersApi, type OrderPage } from './orders-api';

type State = { loading: boolean; page?: OrderPage; error?: string };

@Component({
  selector: 'app-order-history',
  imports: [AmbientVisible, Tilt, Reveal, CurrencyPipe, DatePipe, RouterLink, TitleCasePipe, ShopState],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistory {
  private readonly api = inject(OrdersApi);
  private readonly request = signal({ page: 1 });
  protected readonly confirm = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');

  protected readonly result = toSignal(
    toObservable(this.request).pipe(
      switchMap(({ page }) =>
        this.api.history(page).pipe(
          map((data): State => ({ loading: false, page: data })),
          catchError((error: unknown) =>
            of<State>({ loading: false, error: apiMessage(error, 'Your orders could not load.') }),
          ),
          startWith<State>({ loading: true }),
        ),
      ),
    ),
    { initialValue: { loading: true } as State },
  );

  protected load(page: number) {
    this.confirm.set(null);
    this.error.set('');
    this.request.set({ page });
  }

  protected retry() {
    this.load(this.request().page);
  }

  protected async cancel(orderNumber: string) {
    if (this.busy() || this.confirm() !== orderNumber) return;
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await firstValueFrom(this.api.cancel(orderNumber));
      this.status.set('Order ' + orderNumber + ' was cancelled.');
      this.retry();
    } catch (error) {
      this.error.set(apiMessage(error, 'The order could not be cancelled.'));
    } finally {
      this.busy.set(false);
    }
  }
}
