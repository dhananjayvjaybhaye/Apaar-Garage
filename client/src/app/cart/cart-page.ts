import { AmbientVisible } from '../motion/ambient-visible';
import { Tilt } from '../motion/tilt';
import { Magnetic } from '../motion/magnetic';
import { Reveal } from '../reveal';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { AuthStore } from '../auth/auth-store';
import { ShopState } from '../ui/shop-state';
import { CartStore, type CartItem } from './cart-store';

@Component({
  selector: 'app-cart-page',
  imports: [AmbientVisible, Tilt, Magnetic, Reveal, CurrencyPipe, RouterLink, ShopState],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  protected readonly auth = inject(AuthStore);
  protected readonly store = inject(CartStore);
  protected readonly actionError = signal('');

  constructor() { this.store.activateGuest(); }

  protected changeQuantity(item: CartItem, change: -1 | 1) {
    const quantity = Math.min(item.quantity + change, item.stock);
    return this.update(() => this.store.setQuantity(item.slug, quantity));
  }

  protected remove(item: CartItem) {
    return this.update(() => this.store.remove(item.slug));
  }

  protected removeUnavailable() {
    return this.update(() => this.store.removeUnavailable());
  }

  private async update(action: () => Promise<boolean>) {
    this.actionError.set('');
    try {
      await action();
    } catch (error) {
      this.actionError.set(apiMessage(error, 'The cart could not update. Try again.'));
    }
  }
}
