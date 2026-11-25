import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { apiMessage } from '../../api-message';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { adminAction } from '../admin-action';
import { inputRupees, rupeesPattern, rupeesToPaise } from '../admin-money';

interface Coupon {
  _id: string;
  active: boolean;
  percent?: number | null;
  amountPaise?: number | null;
  minimumPaise: number;
  startsAt?: string | null;
  endsAt?: string | null;
  totalLimit?: number | null;
  perCustomerLimit?: number | null;
  redeemedCount: number;
}

const endpoint = '/api/admin/coupons';
const indiaOffsetMs = (5 * 60 + 30) * 60_000;

@Component({
  imports: [CurrencyPipe, DatePipe, FieldControl, FormField],
  templateUrl: './admin-coupons.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCoupons {
  protected readonly resource = httpResource<{ items: Coupon[] }>(() => endpoint);
  protected readonly action = adminAction();
  protected readonly editing = signal<Coupon | 'new' | null>(null);
  protected readonly discount = signal<'percent' | 'fixed'>('percent');
  protected readonly search = signal('');
  protected readonly money = inputRupees;
  protected readonly moneyPattern = rupeesPattern;
  protected readonly items = computed(() => {
    if (!this.resource.hasValue()) return [];
    return this.resource.value().items.filter(({ _id }) => _id.includes(this.search().trim().toUpperCase()));
  });

  protected edit(coupon: Coupon | 'new') {
    if (this.action.busy()) return;
    this.action.error.set('');
    this.action.notice.set('');
    this.discount.set(coupon !== 'new' && coupon.amountPaise != null ? 'fixed' : 'percent');
    this.editing.set(coupon);
  }

  protected timeInIndia(value?: string | null) {
    return value ? new Date(Date.parse(value) + indiaOffsetMs).toISOString().slice(0, -1) : '';
  }

  protected error() {
    return apiMessage(this.resource.error(), 'Could not load coupons.');
  }

  protected save(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (!this.editing()) return;
    const fields = new FormData(form);
    const value = (key: string) => String(fields.get(key) ?? '').trim();
    const limit = (key: string) => value(key) ? Number(value(key)) : null;
    const date = (key: string) => {
      const local = value(key);
      return local ? local + (local.length === 16 ? ':00' : '') + '+05:30' : null;
    };
    const body = {
      code: value('code').toUpperCase(),
      active: fields.has('active'),
      percent: this.discount() === 'percent' ? Number(value('percent')) : null,
      amountPaise: this.discount() === 'fixed' ? rupeesToPaise(value('amount')) : null,
      minimumPaise: rupeesToPaise(value('minimum')),
      totalLimit: limit('totalLimit'),
      perCustomerLimit: limit('perCustomerLimit'),
      startsAt: date('startsAt'), endsAt: date('endsAt'),
    };
    void this.action.run(this.editing() === 'new' ? 'POST' : 'PUT', endpoint, body, 'Coupon saved.', () => {
      this.editing.set(null);
      this.resource.reload();
    });
  }
}
