import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { Toasts } from '../ui/toasts';
import { apiMessage } from '../api-message';
import { AuthStore } from '../auth/auth-store';

export interface CartItem {
  slug: string;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  unavailableCount?: number;
  freeDeliveryRemainingPaise?: number | null;
}

const emptyCart: Cart = { items: [], totalQuantity: 0, subtotal: 0 };
const cartUrl = '/api/cart';
const guestMarker = 'apaar-has-guest-cart';

function previouslyActive() {
  try { return localStorage.getItem(guestMarker) === '1'; } catch { return false; }
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly toasts = inject(Toasts);
  private readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private readonly guestActive = signal(previouslyActive());
  private readonly resource = httpResource<Cart>(() => {
    const user = this.auth.user();
    return user || (this.guestActive() && this.auth.status() !== 'checking') ? { url: cartUrl } : undefined;
  });
  private readonly pending = signal(false);

  readonly cart = computed(() => this.resource.hasValue() ? this.resource.value() : emptyCart);
  readonly loading = this.resource.isLoading;
  readonly error = this.resource.error;
  readonly busy = this.pending.asReadonly();

  constructor() {
    effect(() => {
      const error = this.error();
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.auth.expireSession(this.auth.user());
      }
    });
  }

  activateGuest() {
    if (!this.auth.user()) this.guestActive.set(true);
  }

  reload() {
    this.resource.reload();
  }

  async add(slug: string, quantity = 1) {
    const changed = await this.mutate(() => this.http.post<Cart>(cartUrl + '/items', { slug, quantity }));
    if (changed) this.toasts.show('Added to cart.');
    return changed;
  }

  setQuantity(slug: string, quantity: number) {
    return this.mutate(() => this.http.patch<Cart>(this.itemUrl(slug), { quantity }));
  }

  remove(slug: string) {
    return this.mutate(() => this.http.delete<Cart>(this.itemUrl(slug)));
  }

  removeUnavailable() {
    return this.mutate(() => this.http.delete<Cart>(cartUrl + '/unavailable'));
  }

  private itemUrl(slug: string) {
    return cartUrl + '/items/' + encodeURIComponent(slug);
  }

  private async mutate(request: () => Observable<Cart>) {
    if (this.busy()) return false;
    this.pending.set(true);
    try {
      await this.auth.ensureSession();
      const user = this.auth.user();
      const cart = await firstValueFrom(request());
      if (this.auth.user() !== user) return false;
      if (!user) {
        this.guestActive.set(true);
        try { localStorage.setItem(guestMarker, '1'); } catch { /* Session cookies still work. */ }
      }
      this.resource.set(cart);
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.auth.expireSession(this.auth.user());
      }
      this.toasts.show(apiMessage(error, 'The cart could not be updated. Try again.'), true);
      throw error;
    } finally {
      this.pending.set(false);
    }
  }
}
