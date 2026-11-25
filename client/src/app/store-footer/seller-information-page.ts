import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogo } from '../ui/brand-logo';
import { SellerContacts } from './seller-contacts';

@Component({
  selector: 'app-seller-information',
  imports: [RouterLink, SellerContacts, BrandLogo],
  template: `
    <main class="container seller-page">
      <app-brand-logo />
      <h1>Seller information</h1>
      <app-seller-contacts />
      <a class="secondary-button" routerLink="/contact">Contact us</a>
    </main>
  `,
  styles: `
    .seller-page {
      padding-block: 2.5rem 5rem;
    }
    .secondary-button {
      margin-block-start: 1.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerInformationPage {}
