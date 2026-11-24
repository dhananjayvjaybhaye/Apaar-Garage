import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SellerContacts } from './seller-contacts';

@Component({
  selector: 'app-seller-information',
  imports: [RouterLink, SellerContacts],
  template: `
    <main class="container seller-page">
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
