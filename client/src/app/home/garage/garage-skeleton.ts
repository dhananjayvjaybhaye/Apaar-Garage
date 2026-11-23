import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { AmbientVisible } from '../../motion/ambient-visible';
import { garageSkeletonLayout } from './garage-skeleton-layout';

@Component({
  selector: 'app-garage-skeleton',
  imports: [AmbientVisible],
  templateUrl: './garage-skeleton.html',
  styleUrl: './garage-skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageSkeleton {
  readonly zoneIndex = input.required<number>();
  private readonly size = signal({ width: 1440, height: 825 });
  protected readonly layout = computed(() => {
    const { width, height } = this.size();
    return garageSkeletonLayout(this.zoneIndex(), width, height);
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const lifetime = inject(DestroyRef);
    afterNextRender(() => {
      const resize = () => {
        if (host.clientWidth && host.clientHeight)
          this.size.set({ width: host.clientWidth, height: host.clientHeight });
      };
      resize();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      lifetime.onDestroy(() => observer.disconnect());
    });
  }
}
