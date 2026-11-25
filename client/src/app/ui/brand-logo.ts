import { ChangeDetectionStrategy, Component } from '@angular/core';

export const brandLogoUrl = '/logo/apaar_garage_rc_racing_logo.png';

@Component({
  selector: 'app-brand-logo',
  template: `<img [src]="source" alt="Apaar Garage" width="1254" height="1254" />`,
  styles: `
    :host {
      display: block;
      width: min(100%, var(--brand-logo-width, 9rem));
      aspect-ratio: 1.85;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 47%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogo {
  protected readonly source = brandLogoUrl;
}
