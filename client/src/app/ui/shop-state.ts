import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AmbientVisible } from '../motion/ambient-visible';

@Component({
  selector: 'app-shop-state',
  imports: [RouterLink],
  template: `
    <div class="state" [class.compact]="compact()">
      @if (illustration(); as art) {
        <img class="state-art" alt="" width="220" height="116" [src]="'/images/ambient/empty-' + art + '.svg'" />
      } @else {
        <div class="illustration" aria-hidden="true"><i></i><span class="icon icon-box"></span><b></b></div>
      }
      <div>
        <h2>{{ title() }}</h2>
        <p [attr.role]="retryable() ? 'alert' : null">{{ message() }}</p>
        @if (retryable()) { <button class="secondary-button" type="button" (click)="retry.emit()">Try again</button> }
        @if (link(); as route) { <a class="primary-button" [routerLink]="route">{{ action() }}</a> }
      </div>
    </div>
  `,
  styles: `
    .state { display:grid; justify-items:center; padding:clamp(1rem,5vw,2.5rem); gap:.85rem; text-align:center; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-large); }
    .state.compact { padding:1rem; }
    h2 { margin:0; font-size:clamp(1.4rem,4vw,2.1rem); }
    p { margin:.45rem 0 .9rem; color:var(--muted); }
    .illustration { position:relative; width:7rem; height:4.7rem; display:grid; place-items:center; border-radius:50%; background:var(--panel-raised); color:var(--accent); }
    .state-art { width:min(100%, 11rem); height:auto; }
    .compact .state-art { width:min(100%, 8rem); }
    .illustration .icon { width:2.65rem; height:2.65rem; transform:rotate(-12deg); }
    i,b { position:absolute; width:.4rem; height:.4rem; border-radius:.12rem; background:var(--amber); transform:rotate(45deg); }
    i { left:1rem; top:1.25rem; } b { right:.9rem; bottom:1.15rem; }
    a, button { margin:.15rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopState {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly action = input('Browse the collection');
  readonly link = input<string>();
  readonly retryable = input(false);
  readonly compact = input(false);
  readonly illustration = input<'garage' | 'shelf'>();
  readonly retry = output<void>();
}

@Component({
  selector: 'app-shop-loading',
  imports: [AmbientVisible],
  template: `
    <p class="visually-hidden" role="status">{{ label() }}</p>
    <div class="loading" [class.cards]="cards()" aria-hidden="true">
      @for (item of (cards() ? [1,2,3,4] : [1,2,3]); track item) {
        <div class="skeleton" [style.--loading-index]="item" appAmbientVisible></div>
      }
    </div>
  `,
  styles: `
    .loading { display:grid; gap:.65rem; margin-block:.65rem; }
    .loading:not(.cards) .skeleton { height:1.1rem; width:calc(100% - var(--loading-index) * 12%); }
    .loading.cards { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .cards .skeleton { aspect-ratio:4 / 3; }
    @media (min-width:49rem) { .loading.cards { grid-template-columns:repeat(4,minmax(0,1fr)); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopLoading {
  readonly label = input('Loading…');
  readonly cards = input(false);
}
