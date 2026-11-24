import { Reveal } from '../reveal';
import { Magnetic } from '../motion/magnetic';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { policyContent, type Policy } from './policy-content';
import { StoreInformation } from './store-info';

@Component({
  selector: 'app-policy-page',
  imports: [Reveal, Magnetic, RouterLink],
  template: `
    <main class="container policy">
      <h1>{{ page().title }}</h1>
      @for (section of page().sections; track section.id) {
        <section appReveal [gentleReveal]="true" [id]="section.id" [attr.aria-labelledby]="section.id + '-title'">
          <h2 [id]="section.id + '-title'">{{ section.heading }}</h2>
          <p>{{ section.text }}</p>
        </section>
      }
      <div class="links">
        <a appMagnetic class="primary-button" routerLink="/contact">Contact us</a>
        <a class="secondary-button" routerLink="/seller-information">Seller and grievance details</a>
        @if (policy() === 'privacy') { <a class="secondary-button" routerLink="/account/privacy">Manage account data</a> }
        <a class="secondary-button" routerLink="/catalog">Browse the collection</a>
      </div>
    </main>
  `,
  styles: `
    .policy { max-width:48rem; min-height:48vh; padding-block:3rem 5rem; }
    h1 { margin:.3rem 0 1.8rem; }
    section { margin-block:1.4rem; }
    h2 { margin:0 0 .4rem; font-size:clamp(1.35rem,4vw,1.85rem); }
    p { color:var(--muted); margin:.45rem 0; }
    .links { margin-top:2rem; display:flex; flex-wrap:wrap; gap:.6rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyPage {
  private readonly store = inject(StoreInformation);
  protected readonly policy = toSignal(inject(ActivatedRoute).data.pipe(map((data) => data['policy'] as Policy)), { requireSync: true });
  protected readonly page = computed(() => policyContent(this.policy(), this.store.data()));
}
