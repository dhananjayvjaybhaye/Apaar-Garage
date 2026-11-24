import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/auth-store';
import { CartStore } from '../cart/cart-store';
import { CheckoutPage } from './checkout-page';
import type { OrderQuote, ShippingAddress } from './orders-api';

const address: ShippingAddress = {
  fullName: 'Test Collector',
  phone: '9876543210',
  addressLine1: '123 Test Street',
  addressLine2: '',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
};

function quote(token: string): OrderQuote {
  return {
    quote: token,
    items: [],
    subtotalPaise: 10000,
    codFeePaise: 0,
    shippingPaise: 0,
    totalPaise: 10000,
    taxPaise: 1525,
    deliveryEstimate: 'Estimated delivery in two days.',
    paymentMethod: 'cod',
  };
}

describe('Checkout delivery quote', () => {
  const reloadCart = vi.fn();
  beforeEach(() => {
    reloadCart.mockClear();
    TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthStore, useValue: { user: signal(null), status: signal('signed-out') } },
        { provide: CartStore, useValue: { reload: reloadCart } },
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('queues one submit while delivery updates and places it with the matching quote', async () => {
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CheckoutPage);
    const page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/orders/quote?empty=ok').flush(quote('general-quote'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('#checkout-summary')?.textContent).toContain('GST included in merchandise');
    expect(page.querySelector('#checkout-summary')?.textContent).toContain('15.25');

    for (const [key, value] of Object.entries(address)) {
      const input = page.querySelector<HTMLInputElement>('#shipping-' + key)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();

    const submit = page.querySelector<HTMLButtonElement>('.place button')!;
    submit.click();
    fixture.detectChanges();
    expect(page.querySelector('#checkout-policies-error')?.textContent).toContain('Accept the store');
    http.expectNone({ method: 'POST', url: '/api/orders' });
    (page.querySelector('#checkout-policies') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(submit.textContent).toContain('Updating delivery');
    submit.click();
    fixture.detectChanges();
    expect(page.querySelector('.place [role="status"]')?.textContent).toContain(
      'when delivery is updated',
    );
    http.expectNone('/api/orders');

    const delivery = await vi.waitFor(() =>
      http.expectOne('/api/orders/quote?empty=ok&pincode=411001'),
    );
    http.expectNone('/api/orders');
    delivery.flush(quote('matching-quote'));

    const order = await vi.waitFor(() => http.expectOne({ method: 'POST', url: '/api/orders' }));
    expect(order.request.body).toMatchObject({
      address,
      quote: 'matching-quote',
      paymentMethod: 'cod',
      acceptPolicies: true,
    });
    order.flush({ orderNumber: 'AG-0123456789ABCD' });
    await fixture.whenStable();
    expect(reloadCart).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/checkout/success', 'AG-0123456789ABCD'], {
      replaceUrl: true,
    });
    http.verify();
  });

  it('shows an empty cart without requiring matchMedia or an HTTP error', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const fixture = TestBed.createComponent(CheckoutPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/orders/quote?empty=ok').flush({ empty: true });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('Your cart is empty');
    expect(page.querySelector('a[href="/catalog"]')?.textContent).toContain('Back to shop');
    expect(page.querySelector('form')).toBeNull();
    http.verify();
  });
});
