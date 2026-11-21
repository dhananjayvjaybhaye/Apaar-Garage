import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TrustStrip } from './trust-strip';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-store-footer',
  imports: [RouterLink, TrustStrip],
  templateUrl: './store-footer.html',
  styleUrl: './store-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreFooter {
  protected readonly shareUrl = encodeURIComponent(location.origin);
}
