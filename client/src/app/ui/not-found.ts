import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AmbientVisible } from '../motion/ambient-visible';
import { BrandLogo } from './brand-logo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, AmbientVisible, BrandLogo],
  template: `
    <main class="container missing-page">
      <div class="crash-scene" appAmbientVisible aria-hidden="true">
        <div class="road-line"></div>
        <img class="car" src="/images/ambient/pit-car.svg" width="132" height="60" alt="" />
        <img class="cone" src="/images/ambient/cone.svg" width="50" height="68" alt="" />
        <span class="impact"></span>
      </div>
      <app-brand-logo />
      <p class="kicker">404</p>
      <h1>Missed the turn.</h1>
      <p>We couldn’t find that page. Let’s get you back to the garage.</p>
      <nav aria-label="Find your way">
        <a class="primary-button" routerLink="/">Back to the garage</a>
        <a class="secondary-button" routerLink="/catalog">Shop the collection</a>
      </nav>
    </main>
  `,
  styleUrl: './not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
