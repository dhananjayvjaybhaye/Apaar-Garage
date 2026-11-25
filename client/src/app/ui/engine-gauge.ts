import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EngineStatus } from './engine-loading';

@Component({
  selector: 'app-engine-gauge',
  template: `
    @let engine = status();
    <div class="engine" [class.compact]="compact()" [class.redline]="(engine.progress ?? 0) >= .9">
      <div class="dial" role="progressbar" aria-label="Loading progress"
        [attr.aria-valuenow]="engine.progress === null ? null : +((engine.progress * 100).toFixed(0))"
        [style.--progress]="engine.progress ?? 0">
        <div class="rim" aria-hidden="true"></div>
        <span class="mark low" aria-hidden="true">0</span>
        <span class="mark middle" aria-hidden="true">4</span>
        <span class="mark high" aria-hidden="true">8</span>
        <span class="rpm" aria-hidden="true">RPM</span>
        <i class="needle" [class.idle]="engine.progress === null" aria-hidden="true"></i>
        <i class="hub" aria-hidden="true"></i>
      </div>
      @if (!engine.ready) {
        <img class="engine-brand" src="/logo/favicon.svg" alt="Apaar Garage" width="24" height="24" loading="lazy" />
      }
      <p role="status">{{ engine.ready ? 'Ready' : 'Starting engine…' }}</p>
    </div>
  `,
  styleUrl: './engine-gauge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineGauge {
  readonly status = input.required<EngineStatus>();
  readonly compact = input(false);
}
