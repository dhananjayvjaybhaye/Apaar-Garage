import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AmbientVisible } from '../motion/ambient-visible';

@Component({
  selector: 'app-track-divider',
  imports: [AmbientVisible],
  host: { 'aria-hidden': 'true' },
  template: '<div class="track" [class]="kind()" appAmbientVisible><span></span></div>',
  styleUrl: './track-divider.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackDivider {
  readonly kind = input.required<'road' | 'runway' | 'checkered'>();
}
