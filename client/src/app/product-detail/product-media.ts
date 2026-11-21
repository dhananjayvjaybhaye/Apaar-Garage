import { Tilt } from '../motion/tilt';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { CarViewer } from '../car-viewer/car-viewer';
import { responsiveImage } from '../ui/responsive-image';
import type { Product } from '../catalog/product';
import { show3dPreviews } from '../storefront-options';

@Component({
  selector: 'app-product-media',
  imports: [Tilt, CarViewer],
  templateUrl: './product-media.html',
  styleUrl: './product-media.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductMedia {
  protected readonly imageSet = responsiveImage;
  readonly product = input.required<Product>();
  protected readonly imageIndex = linkedSignal({
    source: () => this.product().slug,
    computation: () => 0,
  });
  protected readonly zoomed = signal(false);
  readonly initialMode = input<'model' | 'photos'>('model');
  readonly allowModel = input(true);
  readonly keepPhotoDuringLoad = input(false, { transform: booleanAttribute });
  readonly imageSizes = input('(min-width: 80rem) 720px, (min-width: 52rem) 58vw, 100vw');
  protected readonly mode = linkedSignal({
    source: () => this.product().slug,
    computation: () => this.initialMode(),
  });
  protected readonly modelFailed = linkedSignal({
    source: () => this.product().slug,
    computation: () => false,
  });
  protected readonly modelAvailable = computed(
    () => show3dPreviews && Boolean(this.product().glbUrl) && !this.modelFailed(),
  );
  protected readonly showModel = computed(() => this.modelAvailable() && this.mode() === 'model');
  protected readonly modelReady = linkedSignal({
    source: () => this.product().slug,
    computation: () => false,
  });

  protected showPhotos() {
    this.modelReady.set(false);
    this.mode.set('photos');
  }

  protected showPhotosAfterError() {
    this.modelFailed.set(true);
    this.showPhotos();
  }
}
