import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthStore } from '../auth/auth-store';
import { phonePattern, pinPattern, requiredText } from './checkout.config';
import type { ShippingAddress, SavedAddress } from './orders-api';

@Injectable()
export class CheckoutAddress {
  private readonly auth = inject(AuthStore);
  private readonly builder = inject(FormBuilder).nonNullable;
  readonly form = this.builder.group({
    fullName: [this.auth.user()?.name ?? '', requiredText],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    addressLine1: ['', requiredText],
    addressLine2: [''],
    city: ['', requiredText],
    state: ['', requiredText],
    pincode: ['', [Validators.required, Validators.pattern(pinPattern)]],
  });
  readonly email = this.builder.control('', [Validators.email, Validators.maxLength(254)]);
  readonly saveAddress = this.builder.control(false);
  readonly addresses = httpResource<SavedAddress[]>(() =>
    this.auth.user() ? '/api/account/addresses' : undefined,
  );

  fieldError(key: keyof ShippingAddress) {
    const control = this.form.controls[key];
    if (!control.touched || control.valid) return '';
    if (key === 'phone') return 'Enter a valid 10-digit Indian mobile number.';
    if (key === 'pincode') return 'Enter a valid 6-digit pincode.';
    return 'This field is required.';
  }

  applyAddress(id: string) {
    const saved = this.addresses.hasValue()
      ? this.addresses.value().find((entry) => entry.id === id)
      : undefined;
    if (!saved) return;
    const { id: _id, ...address } = saved;
    this.form.setValue({ ...address, addressLine2: address.addressLine2 ?? '' });
    this.saveAddress.setValue(false);
  }
}
