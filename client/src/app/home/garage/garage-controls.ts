import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../../catalog/product';
import { prefetchProductMedia } from '../../product-preview/prefetch-product-media';
import { responsiveImage } from '../../ui/responsive-image';
import { zones } from './garage-path';

@Component({
  selector: 'app-garage-controls',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './garage-controls.html',
  styleUrl: './garage-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageControls {
  readonly activeIndex = input.required<number>();
  readonly product = input<Product>();
  readonly ready = input(false);
  readonly tour = input(false);
  readonly selectZone = output<number>();
  readonly openProduct = output<{ product: Product; source: HTMLElement }>();
  protected readonly zones = zones;
  protected readonly items = computed(() => {
    const product = this.product();
    return product ? [product] : [];
  });
  protected readonly imageSet = responsiveImage;
  protected readonly prefetch = prefetchProductMedia;

  protected onKey(event: KeyboardEvent, tabs: HTMLElement) {
    const directions: Record<string, number> = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    };
    if (!(event.key in directions) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const buttons = [...tabs.querySelectorAll('button')];
    const focused = buttons.findIndex((button) => button === event.target);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? zones.length - 1
          : Math.max(0, Math.min(zones.length - 1, focused + directions[event.key]));
    buttons[next]?.focus({ preventScroll: true });
    this.selectZone.emit(next);
  }
}
