import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { AmbientVisible } from '../motion/ambient-visible';
import { Reveal } from '../reveal';
import { CheckoutDelivery } from './checkout-delivery';
import { CheckoutSubmit } from './checkout-submit';
import { AuthStore } from '../auth/auth-store';
import { OrderTotals } from './order-totals';

@Component({
  selector: 'section[appCheckoutSummary]',
  imports: [AmbientVisible, CurrencyPipe, Reveal, RouterLink, OrderTotals],
  templateUrl: './checkout-summary.html',
  styleUrl: './checkout-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutSummary {
  protected readonly auth = inject(AuthStore);
  protected readonly delivery = inject(CheckoutDelivery);
  protected readonly submit = inject(CheckoutSubmit);
  protected readonly couponInputError = signal('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected applyCoupon(event: Event, input: HTMLInputElement) {
    event.preventDefault();
    if (this.submit.placing()) return;
    const code = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(code)) {
      this.couponInputError.set(
        'Enter a coupon code with 2 to 24 letters, digits, hyphens, or underscores.',
      );
      input.focus();
      return;
    }
    this.couponInputError.set('');
    this.submit.error.set('');
    input.value = code;
    if (this.delivery.coupon() === code) this.delivery.refreshQuote();
    else this.delivery.coupon.set(code);
  }

  protected removeCoupon(input: HTMLInputElement) {
    input.value = '';
    this.delivery.coupon.set('');
    this.couponInputError.set('');
    this.submit.error.set('');
    input.focus();
  }

  protected couponError() {
    if (this.couponInputError()) return this.couponInputError();
    const error = this.delivery.quoteError();
    return this.delivery.coupon() && error instanceof HttpErrorResponse && error.status === 422
      ? apiMessage(error, 'This coupon could not be applied.')
      : '';
  }

  protected quoteError() {
    return apiMessage(this.delivery.quoteError(), 'The order summary could not load.');
  }

  protected showSummary(event: Event) {
    event.preventDefault();
    this.host.nativeElement.scrollIntoView({ block: 'start' });
    this.host.nativeElement.focus({ preventScroll: true });
  }
}
