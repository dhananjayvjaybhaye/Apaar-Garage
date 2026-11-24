import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoreInformation, suppliedText } from './store-info';

@Component({
  selector: 'app-seller-contacts',
  imports: [RouterLink],
  templateUrl: './seller-contacts.html',
  styleUrl: './seller-contacts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerContacts {
  readonly compact = input(false);
  protected readonly store = inject(StoreInformation);
  protected readonly info = this.store.data;
  protected readonly supplied = suppliedText;
  protected readonly address = computed(() => suppliedText(this.info()?.seller.address));
  protected readonly name = computed(() => {
    const seller = this.info()?.seller;
    // Older stores may still have the default trade name copied into the legal name field.
    if (!seller || (!this.address() && seller.legalName === seller.tradeName)) return undefined;
    return suppliedText(seller.legalName);
  });
}
