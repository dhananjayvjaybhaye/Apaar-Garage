import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CheckoutAddress } from './checkout-address';
import { deliveryDebounceMs, pinPattern } from './checkout.config';
import type { OrderQuote } from './orders-api';

@Injectable()
export class CheckoutDelivery {
  private readonly http = inject(HttpClient);
  private readonly address = inject(CheckoutAddress);
  readonly coupon = signal('');
  readonly currentPin = toSignal(this.address.form.controls.pincode.valueChanges, {
    initialValue: '',
  });
  private readonly requestedPin = toSignal(
    this.address.form.controls.pincode.valueChanges.pipe(
      debounceTime(deliveryDebounceMs),
      map((pin) => (pinPattern.test(pin) ? pin : '')),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  private readonly deliveryPin = computed(() =>
    pinPattern.test(this.currentPin()) ? this.currentPin() : '',
  );
  private readonly quoteRequest = rxResource({
    params: () => ({ pin: this.requestedPin(), coupon: this.coupon() }),
    stream: ({ params: { pin, coupon } }) =>
      this.http
        .get<OrderQuote | { empty: true }>('/api/orders/quote', {
          params: { empty: 'ok', ...(pin ? { pincode: pin } : {}), ...(coupon ? { coupon } : {}) },
        })
        .pipe(map((order) => ({ pin, coupon, order }))),
  });
  private readonly matchingResult = computed(() => {
    if (!this.quoteRequest.hasValue()) return undefined;
    const result = this.quoteRequest.value();
    return result.pin === this.deliveryPin() && result.coupon === this.coupon()
      ? result.order
      : undefined;
  });
  readonly emptyCart = computed(() => {
    const order = this.matchingResult();
    return Boolean(order && 'empty' in order);
  });
  readonly quote = computed(() => {
    const order = this.matchingResult();
    return order && !('empty' in order) ? order : undefined;
  });
  readonly updatingDelivery = computed(() => {
    return (
      this.deliveryPin() !== this.requestedPin() ||
      this.quoteRequest.isLoading() ||
      (!this.matchingResult() && !this.quoteRequest.error())
    );
  });

  quoteError() {
    return this.quoteRequest.error();
  }
  refreshQuote() {
    this.quoteRequest.reload();
  }
}
