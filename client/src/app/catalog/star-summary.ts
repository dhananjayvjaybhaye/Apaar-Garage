import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-star-summary',
  template: `
    @if (count() > 0 && average() !== null) {
      <span class="rating" [attr.aria-label]="average() + ' out of 5 stars, ' + count() + (count() === 1 ? ' review' : ' reviews')" role="img">
        <span class="stars" aria-hidden="true"><span>★★★★★</span><b [style.inline-size.%]="filled()">★★★★★</b></span>
        <span aria-hidden="true">{{ average() }} ({{ count() }})</span>
      </span>
    } @else {
      <span class="empty">No reviews yet</span>
    }
  `,
  styles: `
    .rating { display:inline-flex; flex-wrap:wrap; align-items:center; column-gap:.35rem; font-size:.82rem; }
    .stars { display:inline-grid; position:relative; letter-spacing:.02em; font-size:.95rem; }
    .stars span { color:var(--muted); }
    .stars b { position:absolute; inset:0 auto 0 0; overflow:hidden; color:var(--amber); white-space:nowrap; font-weight:inherit; }
    .empty { display:block; color:var(--muted); font-size:.78rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarSummary {
  readonly average = input<number | null>(null);
  readonly count = input(0);
  protected readonly filled = computed(() => (this.average() ?? 0) * 20);
}
