import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../auth/auth-store';
import { CartStore } from '../cart/cart-store';

@Component({
  selector: 'app-mobile-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Mobile navigation">
      <a routerLink="/" routerLinkActive="current" [routerLinkActiveOptions]="{exact:true}" ariaCurrentWhenActive="page"><span class="icon icon-home" aria-hidden="true"></span>Home</a>
      <a routerLink="/catalog" routerLinkActive="current" ariaCurrentWhenActive="page"><span class="icon icon-box" aria-hidden="true"></span>Shop</a>
      <a routerLink="/wishlist" routerLinkActive="current" ariaCurrentWhenActive="page"><span class="icon icon-heart" aria-hidden="true"></span>Wishlist</a>
      <a routerLink="/cart" routerLinkActive="current" ariaCurrentWhenActive="page" [attr.aria-label]="cart.cart().totalQuantity ? 'Cart, ' + cart.cart().totalQuantity + ' items' : 'Cart'">
        <span class="cart-icon"><span class="icon icon-cart" aria-hidden="true"></span>
        @if (cart.cart().totalQuantity; as count) { <span class="count" aria-hidden="true">{{ count }}</span> }
        </span>Cart
      </a>
      <a [routerLink]="auth.user() ? '/orders' : '/login'" routerLinkActive="current" ariaCurrentWhenActive="page"><span class="icon icon-account" aria-hidden="true"></span>Account</a>
    </nav>
  `,
  styles: `
    :host { display:none; }
    @media (width < 52rem) {
      :host { display:block; }
      nav { position:fixed; z-index:18; inset:auto 0 0; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); min-height:var(--mobile-nav-height); padding: .25rem max(.35rem, env(safe-area-inset-right)) max(.25rem, env(safe-area-inset-bottom)) max(.35rem, env(safe-area-inset-left)); background:var(--panel); border-top:1px solid var(--line); }
      a { min-width:0; min-height:2.75rem; display:grid; justify-items:center; align-content:center; gap:.15rem; text-decoration:none; font-size:.76rem; font-weight:650; color:var(--muted); border-radius:.45rem; }
      a.current { color:var(--accent); background:var(--panel-raised); }
      a:focus-visible { outline-offset:-2px; }
      .cart-icon { position:relative; display:flex; }
      .count { position:absolute; top:-.3rem; left:.9rem; min-width:1.05rem; padding:0 .15rem; color:white; background:#b70a04; font-size:.65rem; border-radius:1rem; text-align:center; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNav {
  protected readonly auth = inject(AuthStore);
  protected readonly cart = inject(CartStore);
}
