import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AmbientVisible } from '../motion/ambient-visible';
import { Parallax } from '../motion/parallax';

@Component({
  selector: 'app-garage-ambience',
  imports: [AmbientVisible, Parallax],
  host: { 'aria-hidden': 'true', '[class]': '"ambient-" + mode()' },
  template: `
    @switch (mode()) {
      @case ('site') {
        <span class="asset grid" [appParallax]="0.15"></span>
        <span class="asset tread" [appParallax]="-0.36"></span>
        <span class="asset speed" [appParallax]="0.72"></span>
        <span class="asset car-drawing" [appParallax]="0.45"></span>
      }
      @case ('hero') {
        <div class="beam" appAmbientVisible>
          @for (mark of dust; track $index) {
            <span class="dust" [style.--x]="mark.x + '%'" [style.--y]="mark.y + '%'"
              [style.--delay.s]="-$index * 1.17" [style.--length.s]="7 + $index % 5"></span>
          }
        </div>
        <div class="wheel-layer" [appParallax]="0.85">
          <span class="asset hero-wheel" appAmbientVisible></span>
        </div>
      }
      @case ('scale') {
        <span class="asset gear" [appParallax]="-0.52"></span>
        <span class="asset truck-drawing" [appParallax]="0.32"></span>
        <span class="asset speed" [appParallax]="0.72"></span>
      }
      @case ('flight') {
        <span class="asset grid" [appParallax]="0.14"></span>
        <span class="asset plane-drawing" [appParallax]="0.48"></span>
        <span class="asset speed" [appParallax]="0.64"></span>
      }
    }
  `,
  styleUrl: './garage-ambience.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageAmbience {
  readonly mode = input<'site' | 'hero' | 'scale' | 'flight'>('site');
  protected readonly dust = [
    { x: 28, y: 25 }, { x: 63, y: 12 }, { x: 42, y: 49 }, { x: 75, y: 37 }, { x: 70, y: 58 },
    { x: 58, y: 76 }, { x: 87, y: 39 }, { x: 52, y: 34 }, { x: 34, y: 72 }, { x: 80, y: 70 },
  ];
}
