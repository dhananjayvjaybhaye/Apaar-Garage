import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Product } from '../catalog/product';
import { apiMessage } from '../api-message';
import { Toasts } from '../ui/toasts';
import { WishlistStore } from './wishlist-store';

@Component({
  selector: 'app-wishlist-button',
  template: `
    <button type="button" class="secondary-button" [class.saved]="saved()" [attr.aria-pressed]="saved()"
      [attr.aria-label]="(saved() ? 'Remove from wishlist: ' : 'Save to wishlist: ') + product().name"
      [disabled]="store.busy()" (click)="toggle()"><span aria-hidden="true">{{ saved() ? '♥' : '♡' }}</span></button>
  `,
  styles: 'button { min-width:2.75rem; padding:.15rem .6rem; font-size:1.25rem; } button.saved { color:var(--accent); }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WishlistButton {
  readonly product = input.required<Product>();
  protected readonly store = inject(WishlistStore);
  protected readonly saved = computed(() => this.store.slugs().includes(this.product().slug));
  private readonly toasts = inject(Toasts);

  protected async toggle() {
    if (this.store.busy()) return;
    try {
      await this.store.toggle(this.product().slug);
      this.toasts.show(this.saved() ? 'Saved to wishlist.' : 'Removed from wishlist.');
    } catch (error) {
      this.toasts.show(apiMessage(error, 'Wishlist could not be updated.'), true);
    }
  }
}
