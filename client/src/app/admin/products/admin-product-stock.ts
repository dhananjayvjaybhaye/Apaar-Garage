import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormField, FieldControl } from '../../ui/form-field/form-field';
import { Toasts } from '../../ui/toasts';
import { AdminSessionStore } from '../admin-session-store';
import { productApi } from './admin-products.config';
import { productRequestMessage } from './admin-product-feedback';
import type { AdminProductRecord } from './admin-product-types';

@Component({
  selector: 'app-admin-product-stock',
  imports: [FormField, FieldControl],
  templateUrl: './admin-product-stock.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductStock {
  readonly slug = input.required<string>();
  readonly stock = input.required<string>();
  readonly changed = output<number>();
  private readonly api = inject(AdminSessionStore);
  private readonly toasts = inject(Toasts);
  protected readonly adjusting = signal(false);
  protected readonly error = signal('');
  protected readonly quantityError = signal('');
  protected readonly reasonError = signal('');

  protected async adjust(event: Event, delta: HTMLInputElement, reason: HTMLInputElement) {
    event.preventDefault();
    if (this.adjusting()) return;
    const quantity = delta.valueAsNumber;
    this.quantityError.set(
      Number.isSafeInteger(quantity) && quantity ? '' : 'Enter a non-zero whole quantity.',
    );
    this.reasonError.set(reason.value.trim() ? '' : 'Enter an adjustment reason.');
    this.error.set('');
    if (this.quantityError() || this.reasonError()) return;
    this.adjusting.set(true);
    try {
      const product = await this.api.request<AdminProductRecord>(
        'PATCH',
        productApi + '/' + encodeURIComponent(this.slug()) + '/stock',
        { delta: quantity, reason: reason.value.trim() },
      );
      this.changed.emit(product.stock);
      delta.value = '';
      reason.value = '';
      this.toasts.show('Stock adjustment recorded.');
    } catch (error) {
      this.error.set(productRequestMessage(error, 'Could not adjust stock. Try again.'));
    } finally {
      this.adjusting.set(false);
    }
  }
}
