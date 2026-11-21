import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { mountCarScene } from './car-scene';

@Component({
  selector: 'app-car-viewer',
  templateUrl: './car-viewer.html',
  styleUrl: './car-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarViewer {
  readonly modelUrl = input.required<string>();
  readonly label = input('Product');
  readonly hero = input(false);
  readonly quietLoading = input(false);
  readonly ready = output<void>();
  readonly failed = output<void>();

  private readonly zone = inject(NgZone);
  private readonly renderer = inject(Renderer2);
  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly progress = signal<number | null>(null);

  constructor() {
    effect((onCleanup) => {
      const url = this.modelUrl();
      const hero = this.hero();
      const surface = this.surface().nativeElement;
      const canvas: HTMLCanvasElement = this.renderer.createElement('canvas');
      this.renderer.appendChild(surface, canvas);
      let active = true;
      let dispose: (() => void) | undefined;
      onCleanup(() => {
        active = false;
        this.zone.runOutsideAngular(() => dispose?.());
        this.renderer.removeChild(surface, canvas);
      });
      this.status.set('loading');
      this.progress.set(null);

      const fail = () =>
        this.zone.run(() => {
          if (!active) return;
          this.status.set('error');
          this.failed.emit();
        });

      try {
        dispose = this.zone.runOutsideAngular(() =>
          mountCarScene(
            canvas,
            url,
            {
              onProgress: (percent) => this.zone.run(() => this.progress.set(percent)),
              onReady: () =>
                this.zone.run(() => {
                  this.status.set('ready');
                  this.ready.emit();
                }),
              onError: fail,
            },
            hero,
          ),
        );
      } catch {
        void Promise.resolve().then(fail);
      }
    });
  }
}
