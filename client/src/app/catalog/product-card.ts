import { ProductPreview } from '../product-preview/product-preview';
import { Tilt } from '../motion/tilt';
import { Magnetic } from '../motion/magnetic';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { WishlistButton } from '../shop/wishlist-button';
import { StockAlert } from '../shop/stock-alert';
import { flyToCart } from '../cart/cart-flight';
import { CartStore } from '../cart/cart-store';
import { StarSummary } from './star-summary';
import { responsiveImage } from '../ui/responsive-image';
import { AmbientVisible } from '../motion/ambient-visible';
import type { Product } from './product';

@Component({
  selector: 'app-product-card',
  imports: [Tilt, Magnetic, CurrencyPipe, RouterLink, WishlistButton, StockAlert, StarSummary, AmbientVisible],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly headingLevel = input<3 | 4>(3);
  protected readonly imageSet = responsiveImage;
  readonly priority = input(false);
  readonly imageSizes = input(
    '(min-width: 80rem) 304px, (min-width: 49rem) calc((100vw - 5.6rem) / 4), calc((100vw - 2.6rem) / 2)',
  );
  readonly addLabel = input('Add');
  readonly tiltDegrees = input(10);
  protected readonly cart = inject(CartStore);
  private readonly preview = inject(ProductPreview);
  protected readonly adding = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal(false);
  protected readonly isNew = computed(() => {
    const date = Date.parse(this.product().addedAt ?? '');
    const age = Date.now() - date;
    return age >= 0 && age < 14 * 86400000;
  });

  protected quickView(source: HTMLElement) {
    this.preview.open({ product: this.product(), source });
  }

  protected async add(button: HTMLButtonElement) {
    if (this.adding() || this.cart.busy()) return;
    this.adding.set(true);
    this.error.set(false);
    this.message.set('');
    try {
      if (await this.cart.add(this.product().slug)) {
        const image = button.closest('.product')?.querySelector<HTMLImageElement>('.product-photo img');
        flyToCart(button, image?.currentSrc || this.product().images[0]);
        this.message.set('Added to cart');
      }
    } catch (error) {
      this.error.set(true);
      this.message.set(apiMessage(error, 'Unable to add this model. Try again.'));
    } finally {
      this.adding.set(false);
    }
  }
}
