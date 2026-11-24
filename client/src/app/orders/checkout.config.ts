import { Validators } from '@angular/forms';
import type { ShippingAddress } from './orders-api';

// Delivery estimates wait for typing to pause before requesting a new quote.
export const deliveryDebounceMs = 250;
export const requiredText = [Validators.required, Validators.pattern(/\S/)];
export const pinPattern = /^[1-9]\d{5}$/;
interface CheckoutField {
  key: keyof ShippingAddress;
  label: string;
  autocomplete: string;
  max: number;
  wide?: boolean;
  mode?: string;
  hint?: string;
}

export const checkoutFields: readonly CheckoutField[] = [
  { key: 'fullName', label: 'Full name', autocomplete: 'name', max: 100, wide: true },
  {
    key: 'phone',
    label: 'Indian mobile number',
    autocomplete: 'tel-national',
    max: 10,
    mode: 'numeric',
    hint: 'Enter 10 digits, without +91.',
    wide: true,
  },
  {
    key: 'addressLine1',
    label: 'Street address',
    autocomplete: 'address-line1',
    max: 160,
    wide: true,
  },
  {
    key: 'addressLine2',
    label: 'Apartment, floor, or landmark (optional)',
    autocomplete: 'address-line2',
    max: 160,
    wide: true,
  },
  { key: 'city', label: 'City', autocomplete: 'address-level2', max: 80 },
  { key: 'state', label: 'State or union territory', autocomplete: 'address-level1', max: 80 },
  {
    key: 'pincode',
    label: 'Pincode',
    autocomplete: 'postal-code',
    max: 6,
    mode: 'numeric',
    hint: 'Enter 6 digits.',
  },
];
