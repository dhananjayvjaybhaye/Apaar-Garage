import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import type { gsap } from 'gsap';
import { Subject } from 'rxjs';
import type { Product } from '../catalog/product';

export interface PreviewPoint { x: number; y: number }
export interface PreviewRequest {
  product: Product;
  source?: HTMLElement;
  point?: PreviewPoint;
  animator?: typeof gsap;
  viewerAvailable?: Signal<boolean>;
  retarget?: (point: PreviewPoint, modalMoving: boolean) => boolean;
  prioritizeOverlay?: () => void;
  enter?: (signal: AbortSignal) => void;
  exit?: (signal: AbortSignal) => void;
}

@Injectable({ providedIn: 'root' })
export class ProductPreview {
  private readonly current = signal<PreviewRequest | null>(null);
  private readonly openings = new Subject<PreviewRequest>();
  readonly request = this.current.asReadonly();
  readonly opened = this.openings.asObservable();

  constructor() {
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) this.current.set(null);
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  open(request: PreviewRequest) {
    this.current.set(request);
    this.openings.next(request);
  }

  clear(request: PreviewRequest) {
    if (this.current() === request) this.current.set(null);
  }
}
