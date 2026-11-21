import { Magnetic } from '../motion/magnetic';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { apiMessage } from '../api-message';
import { AuthStore } from '../auth/auth-store';
import { ShopSearch } from './shop-search';
import { MiniCart } from '../cart/mini-cart';
import { categoryLabels, rcCategories } from '../catalog/product';
import { GarageSound } from '../ui/garage-sound';
import { StoreHeaderSize } from './store-header-size';

@Component({
  selector: 'app-store-header',
  imports: [Magnetic, RouterLink, RouterLinkActive, MiniCart, ShopSearch],
  templateUrl: './store-header.html',
  styleUrl: './store-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreHeader {
  protected readonly rcLinks = rcCategories.map((category) => ({ category, label: categoryLabels[category] }));
  protected readonly sound = inject(GarageSound);
  protected readonly auth = inject(AuthStore);
  protected readonly signingOut = signal(false);
  protected readonly error = signal('');

  constructor() {
    inject(StoreHeaderSize);
    void this.auth.ensureSession();
  }

  protected closeRcMenu(event: FocusEvent, menu: HTMLDetailsElement) {
    if (!(event.relatedTarget instanceof Node) || !menu.contains(event.relatedTarget)) menu.open = false;
  }

  protected escapeRcMenu(menu: HTMLDetailsElement, trigger: HTMLElement, event: Event) {
    if (!menu.open) return;
    event.preventDefault();
    menu.open = false;
    trigger.focus();
  }

  protected async logout() {
    if (this.signingOut()) return;
    this.error.set('');
    this.signingOut.set(true);
    try {
      await this.auth.logout();
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not sign out. Try again.'));
    } finally {
      this.signingOut.set(false);
    }
  }
}
