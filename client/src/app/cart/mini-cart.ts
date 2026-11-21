import { Magnetic } from '../motion/magnetic';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { apiMessage } from '../api-message';
import { ShopLoading, ShopState } from '../ui/shop-state';
import { CartStore, type CartItem } from './cart-store';

@Component({
  selector: 'app-mini-cart',
  imports: [Magnetic, CurrencyPipe, RouterLink, ShopLoading, ShopState],
  templateUrl: './mini-cart.html',
  styleUrl: './mini-cart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniCart {
  protected readonly store = inject(CartStore);
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  protected readonly undone = signal<CartItem | null>(null);
  protected readonly error = signal('');
  protected readonly open = signal(false);

  constructor() {
    inject(Router).events.pipe(filter((event) => event instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => this.close());
  }

  protected show(dialog: HTMLDialogElement) {
    this.store.activateGuest();
    this.error.set('');
    this.undone.set(null);
    dialog.showModal();
    this.open.set(true);
  }

  protected close() {
    const drawer = this.drawer()?.nativeElement;
    if (drawer?.open) drawer.close();
    this.open.set(false);
  }

  protected quantity(item: CartItem, amount: number) {
    return this.act(() => this.store.setQuantity(item.slug, Math.min(item.quantity + amount, item.stock)));
  }

  protected async remove(item: CartItem) {
    if (await this.act(() => this.store.remove(item.slug))) this.undone.set(item);
  }

  protected async undo(item: CartItem) {
    if (await this.act(() => this.store.add(item.slug, item.quantity))) this.undone.set(null);
  }

  private async act(action: () => Promise<boolean>) {
    this.error.set('');
    try {
      return await action();
    } catch (error) {
      this.error.set(apiMessage(error, 'The cart could not be updated.'));
      return false;
    }
  }
}
