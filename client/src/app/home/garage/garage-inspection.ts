import { signal, type NgZone } from '@angular/core';
import type { gsap } from 'gsap';
import type { Product } from '../../catalog/product';
import type { PreviewPoint, PreviewRequest } from '../../product-preview/product-preview';
import { heroCamera } from '../hero.config';
import { garageZoneFor, zones } from './garage-path';
import type { mountGarage } from './garage-renderer';

type GarageScene = ReturnType<typeof mountGarage>;

interface InspectionOptions {
  stage: HTMLElement;
  view: Window;
  zone: NgZone;
  animator: typeof gsap;
  read: () => GarageScene;
  cancelled: () => boolean;
  restart: () => boolean;
  freeze: (signal: AbortSignal, ready: () => void) => Promise<void>;
  holdSelection: (held: boolean) => void;
  select: (product: Product, point: PreviewPoint) => void;
  fallback: () => void;
}

export function connectInspection(options: InspectionOptions) {
  const { stage, view, zone, animator, read, cancelled } = options;
  const blend = { value: 0, x: 0 };

  const inspect = (product: Product, point?: PreviewPoint): Partial<PreviewRequest> => {
    const bounds = stage.getBoundingClientRect();
    const header = stage.ownerDocument.querySelector('app-store-header');
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const zoom = Boolean(
      read() && bounds.top >= headerBottom - 2 && bounds.bottom <= view.innerHeight + 2,
    );
    const zoneX = zones.find(({ category }) => category === garageZoneFor(product))!.x;
    const viewerAvailable = signal(false);
    const freeze = (signal: AbortSignal) => options.freeze(signal, () => viewerAvailable.set(true));

    function animate(value: number, signal: AbortSignal, complete?: () => void) {
      zone.runOutsideAngular(() => {
        animator.killTweensOf(blend);
        if (signal.aborted || cancelled()) return;
        if (blend.value === 0) blend.x = zoneX;
        const tween = animator.to(blend, {
          value,
          x: value === 1 ? zoneX : blend.x,
          duration: heroCamera.inspectionSeconds,
          ease: 'power2.out',
          onUpdate: () => read()?.focus(blend.x, blend.value),
          onComplete: () => {
            signal.removeEventListener('abort', abort);
            complete?.();
          },
        });
        const abort = () => tween.kill();
        signal.addEventListener('abort', abort, { once: true });
      });
    }

    return {
      point: point ?? read()?.pointFor(product),
      animator,
      viewerAvailable,
      prioritizeOverlay: () => read()?.prioritizeOverlay(),
      retarget: (position, modalMoving) => {
        if (!modalMoving && !animator.isTweening(blend)) return false;
        const next = read()?.productAt(position.x, position.y);
        if (!next || next.slug === product.slug) return false;
        options.select(next, position);
        return true;
      },
      enter: (signal) => {
        options.holdSelection(true);
        if (zoom) animate(1, signal, () => void freeze(signal));
        else {
          animator.killTweensOf(blend);
          blend.value = 0;
          read()?.focus(blend.x, 0);
          // Give the dialog's first paint priority over capturing the garage canvas.
          view.setTimeout(() => void freeze(signal), heroCamera.inspectionSnapshotMs);
        }
      },
      exit: (signal) => {
        if (signal.aborted || cancelled()) return;
        options.holdSelection(false);
        try {
          if (!read() && !options.restart()) {
            options.fallback();
            return;
          }
          read()?.focus(blend.x, blend.value);
          if (blend.value > 0) animate(0, signal);
        } catch {
          options.fallback();
        }
      },
    };
  };

  return { inspect, destroy: () => animator.killTweensOf(blend) };
}
