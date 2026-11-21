import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { StockWatch } from './stock-watch';

@Component({
  selector: 'app-stock-alert',
  template: `
    <button type="button" class="secondary-button" [attr.aria-pressed]="subscribed()" (click)="watch.toggle(slug())">
      Notify me when back in stock
    </button>
    @if (subscribed()) {
      <p class="muted" role="status">You’ll see a stock alert here when this model returns.</p>
    }
  `,
  styles: ':host { display:block; margin-top:.65rem; } p { margin:.35rem 0; font-size:.85rem; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockAlert {
  readonly slug = input.required<string>();
  protected readonly watch = inject(StockWatch);
  protected readonly subscribed = computed(() => this.watch.slugs().includes(this.slug()));
}
