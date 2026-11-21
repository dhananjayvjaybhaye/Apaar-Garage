import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Parallax } from '../motion/parallax';

@Component({
  selector: 'app-garage-ambience',
  imports: [Parallax],
  host: { 'aria-hidden': 'true', '[class]': '"ambient-" + mode()' },
  template: `
    @switch (mode()) {
      @case ('site') {
        <span class="asset grid" [appParallax]="0.15"></span>
        <span class="asset tread" [appParallax]="-0.36"></span>
        <span class="asset speed" [appParallax]="0.72"></span>
        <span class="asset car-drawing" [appParallax]="0.45"></span>
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
  readonly mode = input<'site' | 'scale' | 'flight'>('site');
}
