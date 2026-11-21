import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';
import { AuthStore } from '../auth/auth-store';
import { CartStore } from '../cart/cart-store';
import { CheckoutAddress } from './checkout-address';
import { CheckoutDelivery } from './checkout-delivery';
import { OrdersApi } from './orders-api';

@Injectable()
export class CheckoutSubmit {
  private readonly api = inject(OrdersApi);
  private readonly auth = inject(AuthStore);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly shipping = inject(CheckoutAddress);
  private readonly delivery = inject(CheckoutDelivery);
  private readonly checkoutKey = crypto.randomUUID();
  readonly placing = signal(false);
  private readonly pendingOrder = signal<{
    form: HTMLFormElement;
    pin: string;
    coupon: string;
  } | null>(null);
  readonly queued = computed(() => this.pendingOrder() !== null);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const pending = this.pendingOrder();
      if (!pending) return;
      if (pending.pin !== this.delivery.currentPin() || pending.coupon !== this.delivery.coupon()) {
        this.pendingOrder.set(null);
        return;
      }
      if (this.delivery.updatingDelivery()) return;
      this.pendingOrder.set(null);
      if (this.delivery.quote()) untracked(() => void this.place(pending.form));
    });
  }

  async place(form: HTMLFormElement) {
    if (this.placing()) return;
    this.error.set('');
    this.shipping.form.markAllAsTouched();
    this.shipping.email.markAsTouched();
    const quote = this.delivery.quote();
    const useEmail = !this.auth.user() && quote?.emailUpdates;
    if (this.shipping.form.invalid || (useEmail && this.shipping.email.invalid)) {
      form.querySelector<HTMLElement>('.ng-invalid')?.focus();
      return;
    }

    const address = this.shipping.form.getRawValue();
    if (this.delivery.updatingDelivery()) {
      this.pendingOrder.set({ form, pin: address.pincode, coupon: this.delivery.coupon() });
      return;
    }
    if (!quote) return;

    this.pendingOrder.set(null);
    this.placing.set(true);
    try {
      const result = await firstValueFrom(
        this.api.place(address, quote.quote, this.checkoutKey, {
          saveAddress: Boolean(this.auth.user() && this.shipping.saveAddress.value),
          coupon: this.delivery.coupon() || undefined,
          email: useEmail ? this.shipping.email.value.trim() || undefined : undefined,
        }),
      );
      this.cart.reload();
      await this.router.navigate(['/checkout/success', result.orderNumber], { replaceUrl: true });
    } catch (error) {
      if (error instanceof HttpErrorResponse && [409, 422].includes(error.status))
        this.delivery.refreshQuote();
      this.error.set(
        apiMessage(error, 'The order could not be placed. You can retry this checkout.'),
      );
    } finally {
      this.placing.set(false);
    }
  }
}
