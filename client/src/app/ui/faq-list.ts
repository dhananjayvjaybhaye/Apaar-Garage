import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type FaqEntry } from './faq-content';

@Component({
  selector: 'app-faq-list',
  imports: [RouterLink],
  template: `
    @for (entry of entries(); track entry.id) {
      <details>
        <summary>{{ entry.question }}<span aria-hidden="true">+</span></summary>
        <div class="answer">
          <p>{{ entry.answer }}</p>
          @if (entry.link; as link) {
            <a [routerLink]="link.path">{{ link.label }}</a>
          }
        </div>
      </details>
    }
  `,
  styleUrl: './faq-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqList {
  readonly entries = input.required<readonly FaqEntry[]>();
}
