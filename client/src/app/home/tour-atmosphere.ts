import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-tour-atmosphere',
  template: `
    <div class="glows"><i></i><i></i><i></i></div>
    <div class="depth">
      <div class="shelves"></div>
      <div class="floor"></div>
    </div>
    <div class="beams"><i></i><i></i></div>
    <div class="particles">
      @for (particle of particles; track $index) {
        <i
          [style.left.%]="particle[0]"
          [style.top.%]="particle[1]"
          [style.animation-delay.s]="-$index * 1.37"
          [class.bokeh]="$index % 4 === 0"
        ></i>
      }
    </div>
  `,
  styleUrl: './tour-atmosphere.css',
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TourAtmosphere {
  protected readonly particles = [
    [4, 27],
    [95, 68],
    [15, 82],
    [89, 18],
    [31, 45],
    [98, 47],
    [2, 62],
    [83, 87],
    [61, 14],
    [9, 11],
    [71, 96],
    [91, 39],
  ];
}
