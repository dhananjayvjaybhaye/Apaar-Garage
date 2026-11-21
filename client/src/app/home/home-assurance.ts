import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../reveal';
import { FaqList } from '../ui/faq-list';
import { homeQuestions } from '../ui/faq-content';

@Component({
  selector: 'app-home-assurance',
  imports: [RouterLink, Reveal, FaqList],
  template: `
    <section class="container assurance" aria-labelledby="assurance-title" appReveal>
      <h2 id="assurance-title">Why Apaar Garage</h2>
      <ul>
        @for (reason of reasons; track reason.title) {
          <li>
            <span class="assurance-mark" aria-hidden="true">{{ reason.icon }}</span>
            <h3>{{ reason.title }}</h3>
            <p>{{ reason.text }}</p>
          </li>
        }
      </ul>
    </section>
    <section class="container assurance" aria-labelledby="home-faq-title" appReveal>
      <div class="faq-heading">
        <h2 id="home-faq-title">Frequently asked questions</h2>
        <a routerLink="/faq">See all FAQs</a>
      </div>
      <app-faq-list [entries]="faqs" />
    </section>
  `,
  styles: `
    .assurance {
      padding-block: clamp(1.75rem, 4vw, 3.6rem);
    }
    h2 {
      margin: 0 0 1rem;
      text-transform: uppercase;
    }
    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius-large);
      background: var(--panel);
    }
    .assurance-mark {
      color: var(--amber);
      font-size: 1.4rem;
    }
    h3 {
      margin: 0.35rem 0;
    }
    p {
      color: var(--muted);
      margin: 0;
    }
    .faq-heading {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .faq-heading a {
      display: inline-grid;
      min-height: 44px;
      align-items: center;
      font-weight: 700;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAssurance {
  protected readonly faqs = homeQuestions;
  protected readonly reasons = [
    {
      icon: '✓',
      title: 'Genuine models',
      text: 'Check each listing for its maker and scale. Sample listings are clearly marked.',
    },
    {
      icon: '◇',
      title: 'Safe packaging',
      text: 'Models and their display boxes are packed for transit.',
    },
    {
      icon: '₹',
      title: 'Cash on Delivery',
      text: 'Pay on arrival where COD is available for your pincode.',
    },
    {
      icon: '↶',
      title: 'Easy returns',
      text: 'Contact support with your order number to start a return.',
    },
  ];
}
