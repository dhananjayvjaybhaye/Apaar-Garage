import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SellerContacts } from './seller-contacts';
import { TrustStrip } from './trust-strip';
import { RouterLink } from '@angular/router';
import { BrandLogo } from '../ui/brand-logo';

@Component({
  selector: 'app-store-footer',
  imports: [RouterLink, TrustStrip, SellerContacts, BrandLogo],
  templateUrl: './store-footer.html',
  styleUrl: './store-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreFooter {
  protected readonly shareUrl = encodeURIComponent(location.origin);
}
