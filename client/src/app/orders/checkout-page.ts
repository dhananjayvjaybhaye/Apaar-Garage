import { FormField, FieldControl } from '../ui/form-field/form-field';
import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../auth/auth-store';
import { Magnetic } from '../motion/magnetic';
import { Tilt } from '../motion/tilt';
import { Reveal } from '../reveal';
import { mediaQuery } from '../ui/media-query';
import { ShopState } from '../ui/shop-state';
import { CheckoutAddress } from './checkout-address';
import { CheckoutDelivery } from './checkout-delivery';
import { CheckoutSubmit } from './checkout-submit';
import { CheckoutSummary } from './checkout-summary';
import { checkoutFields } from './checkout.config';

@Component({
  selector: 'app-checkout-page',
  imports: [FormField, FieldControl, Tilt, Magnetic, Reveal, ReactiveFormsModule, RouterLink, ShopState, CheckoutSummary],
  providers: [CheckoutAddress, CheckoutDelivery, CheckoutSubmit],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage {
  protected readonly auth = inject(AuthStore);
  protected readonly shipping = inject(CheckoutAddress);
  protected readonly delivery = inject(CheckoutDelivery);
  protected readonly submit = inject(CheckoutSubmit);
  protected readonly fields = checkoutFields;

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => {
      if (
        mediaQuery('(pointer: fine)', document.defaultView)?.matches &&
        !this.shipping.form.controls.fullName.value &&
        document.activeElement === document.body
      ) {
        document.getElementById('shipping-fullName')?.focus({ preventScroll: true });
      }
    });
  }
}
