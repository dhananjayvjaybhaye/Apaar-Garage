import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCard } from '../catalog/product-card';
import type { Product } from '../catalog/product';
import { Motion } from '../motion/motion';
import type { GarageZone } from './garage/garage-path';
import { animateCategoryScenes } from './category-stages-motion';
import { categoryScenes } from './category-scenes.config';

export interface CategoryScene {
  id: GarageZone;
  name: string;
  note: string;
  items: readonly Product[];
  loading: boolean;
  error?: boolean;
}

@Component({
  selector: 'app-category-stages',
  imports: [ProductCard, RouterLink],
  templateUrl: './category-stages.html',
  styleUrls: ['./category-stages.css', './category-stages-atmosphere.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryStages {
  readonly stops = input.required<readonly CategoryScene[]>();
  protected readonly config = categoryScenes;
  private readonly listing = viewChild.required<ElementRef<HTMLElement>>('listing');
  private readonly motion = inject(Motion);

  constructor() {
    afterRenderEffect((cleanup) => {
      const listing = this.listing().nativeElement;
      const view = listing.ownerDocument.defaultView;
      if (!view) return;
      // Rebuild the row animations when the API replaces a loading state or its results.
      const ready = this.stops().some((stop) => !stop.loading);
      let alive = true;
      let dispose: (() => void) | undefined;
      const loadMotion = () =>
        void this.motion.loadScrollTools().then((tools) => {
          if (alive && tools)
            this.motion.zone.runOutsideAngular(() => {
              dispose = animateCategoryScenes(listing, tools);
            });
        });
      const near =
        ready && typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver(
              (entries, observer) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                observer.disconnect();
                loadMotion();
              },
              { threshold: 0.15 },
            )
          : undefined;
      // A direct category link can land past the first heading.
      listing.querySelectorAll('[data-scene-heading]').forEach((heading) => near?.observe(heading));
      cleanup(() => {
        alive = false;
        dispose?.();
        near?.disconnect();
      });
    });
  }
}
