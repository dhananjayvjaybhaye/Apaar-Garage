import { AmbientVisible } from '../motion/ambient-visible';
import { Tilt } from '../motion/tilt';
import { Magnetic } from '../motion/magnetic';
import { Reveal } from '../reveal';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { apiMessage } from '../api-message';
import { AuthStore } from '../auth/auth-store';
import { CartStore } from '../cart/cart-store';
import { OrderTotals } from './order-totals';
import { type OrderQuote, type SavedAddress, type ShippingAddress, OrdersApi } from './orders-api';

const phonePattern = /^[6-9]\d{9}$/;
const pinPattern = /^[1-9]\d{5}$/;
const requiredText = [Validators.required, Validators.pattern(/\S/)];
const fields = [
  { key: 'fullName', label: 'Full name', autocomplete: 'name', max: 100, wide: true },
  { key: 'phone', label: 'Indian mobile number', autocomplete: 'tel-national', max: 10, mode: 'numeric', hint: 'Enter 10 digits, without +91.', wide: true },
  { key: 'addressLine1', label: 'Street address', autocomplete: 'address-line1', max: 160, wide: true },
  { key: 'addressLine2', label: 'Apartment, floor, or landmark (optional)', autocomplete: 'address-line2', max: 160, wide: true },
  { key: 'city', label: 'City', autocomplete: 'address-level2', max: 80 },
  { key: 'state', label: 'State or union territory', autocomplete: 'address-level1', max: 80 },
  { key: 'pincode', label: 'Pincode', autocomplete: 'postal-code', max: 6, mode: 'numeric', hint: 'Enter 6 digits.' },
] as const satisfies ReadonlyArray<{ key: keyof ShippingAddress; label: string; autocomplete: string; max: number; wide?: boolean; mode?: string; hint?: string }>;

@Component({
  selector: 'app-checkout-page',
  imports: [AmbientVisible, Tilt, Magnetic, Reveal, CurrencyPipe, ReactiveFormsModule, RouterLink, OrderTotals],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage {
  private readonly api = inject(OrdersApi);
  protected readonly auth = inject(AuthStore);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly builder = inject(FormBuilder).nonNullable;
  private readonly checkoutKey = crypto.randomUUID();

  protected readonly fields: ReadonlyArray<{ key: keyof ShippingAddress; label: string; autocomplete: string; max: number; wide?: boolean; mode?: string; hint?: string }> = fields;
  protected readonly placing = signal(false);
  protected readonly error = signal('');
  protected readonly address = this.builder.group({
    fullName: [this.auth.user()?.name ?? '', requiredText],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    addressLine1: ['', requiredText],
    addressLine2: [''],
    city: ['', requiredText],
    state: ['', requiredText],
    pincode: ['', [Validators.required, Validators.pattern(pinPattern)]],
  });
  protected readonly email = this.builder.control('', [Validators.email, Validators.maxLength(254)]);
  protected readonly coupon = signal('');
  protected readonly couponInputError = signal('');
  protected readonly saveAddress = this.builder.control(false);
  protected readonly addresses = httpResource<SavedAddress[]>(() =>
    this.auth.user() ? '/api/account/addresses' : undefined,
  );
  private readonly quotedPin = toSignal(this.address.controls.pincode.valueChanges.pipe(
    debounceTime(250),
    map((value) => pinPattern.test(value) ? value : ''),
    distinctUntilChanged(),
  ), { initialValue: '' });
  protected readonly quote = httpResource<OrderQuote>(() => {
    const params: Record<string, string> = {};
    const pin = this.quotedPin();
    const coupon = this.coupon();
    if (pin) params['pincode'] = pin;
    if (coupon) params['coupon'] = coupon;
    return { url: '/api/orders/quote', params };
  });

  constructor() {
    afterNextRender(() => {
      if (matchMedia('(pointer: fine)').matches && !this.address.controls.fullName.value && document.activeElement === document.body) {
        document.getElementById('shipping-fullName')?.focus({ preventScroll: true });
      }
    });
  }

  protected fieldError(key: keyof ShippingAddress) {
    const control = this.address.controls[key];
    if (!control.touched || control.valid) return '';
    if (key === 'phone') return 'Enter a valid 10-digit Indian mobile number.';
    if (key === 'pincode') return 'Enter a valid 6-digit pincode.';
    return 'This field is required.';
  }

  protected applyAddress(id: string) {
    const saved = this.addresses.hasValue() ? this.addresses.value().find((entry) => entry.id === id) : undefined;
    if (!saved) return;
    const { id: _id, ...address } = saved;
    this.address.setValue({ ...address, addressLine2: address.addressLine2 ?? '' });
    this.saveAddress.setValue(false);
  }

  protected applyCoupon(event: Event, input: HTMLInputElement) {
    event.preventDefault();
    if (this.placing()) return;
    const code = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(code)) {
      this.couponInputError.set('Enter a coupon code with 2 to 24 letters, digits, hyphens, or underscores.');
      input.focus();
      return;
    }
    this.couponInputError.set('');
    this.error.set('');
    input.value = code;
    if (this.coupon() === code) this.quote.reload();
    else this.coupon.set(code);
  }

  protected removeCoupon(input: HTMLInputElement) {
    input.value = '';
    this.coupon.set('');
    this.couponInputError.set('');
    this.error.set('');
    input.focus();
  }

  protected couponError() {
    if (this.couponInputError()) return this.couponInputError();
    const error = this.quote.error();
    return this.coupon() && error instanceof HttpErrorResponse && error.status === 422
      ? apiMessage(error, 'This coupon could not be applied.')
      : '';
  }

  protected quoteError() {
    return apiMessage(this.quote.error(), 'The order summary could not load.');
  }

  protected async place(form: HTMLFormElement) {
    if (this.placing()) return;
    this.error.set('');
    this.address.markAllAsTouched();
    this.email.markAsTouched();
    const useEmail = !this.auth.user() && this.quote.hasValue() && this.quote.value().emailUpdates;
    if (this.address.invalid || (useEmail && this.email.invalid)) {
      form.querySelector<HTMLElement>('.ng-invalid')?.focus();
      return;
    }

    const address = this.address.getRawValue();
    if (this.quotedPin() !== address.pincode || this.quote.isLoading()) {
      this.error.set('Wait for the delivery estimate to finish, then place your order.');
      return;
    }
    if (!this.quote.hasValue()) return;

    this.placing.set(true);
    try {
      const result = await firstValueFrom(
        this.api.place(address, this.quote.value().quote, this.checkoutKey, {
          saveAddress: Boolean(this.auth.user() && this.saveAddress.value),
          coupon: this.coupon() || undefined,
          email: useEmail ? this.email.value.trim() || undefined : undefined,
        }),
      );
      this.cart.reload();
      await this.router.navigate(['/checkout/success', result.orderNumber], { replaceUrl: true });
    } catch (error) {
      if (error instanceof HttpErrorResponse && [409, 422].includes(error.status)) this.quote.reload();
      this.error.set(apiMessage(error, 'The order could not be placed. You can retry this checkout.'));
    } finally {
      this.placing.set(false);
    }
  }
}
