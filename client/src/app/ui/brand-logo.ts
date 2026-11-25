import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  template: `
    <picture>
      @if (sizes(); as displaySizes) {
        <source type="image/webp" srcset="/logo/header@2x.webp 280w, /logo/display.webp 560w" [attr.sizes]="displaySizes" />
      } @else {
        <source type="image/webp" srcset="/logo/header.webp 1x, /logo/header@2x.webp 2x" />
      }
      <img
        src="/logo/header.png"
        srcset="/logo/header.png 1x, /logo/header@2x.png 2x"
        alt="Apaar Garage"
        width="140"
        height="75"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
      />
    </picture>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, var(--brand-logo-width, 9rem));
    }
    img {
      width: 100%;
      height: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogo {
  readonly priority = input(false);
  readonly sizes = input<string>();
}
