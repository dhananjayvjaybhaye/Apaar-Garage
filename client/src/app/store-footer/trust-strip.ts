import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-trust-strip',
  imports: [RouterLink],
  template: `
    <div class="strip">
      <ul class="container" aria-label="Shopping with Apaar Garage">
        @for (item of items; track item.label) {
          <li><a [routerLink]="item.link" [fragment]="item.fragment"><span [class]="'icon ' + item.icon" aria-hidden="true"></span>{{ item.label }}</a></li>
        }
      </ul>
    </div>
  `,
  styles: `
    .strip { border-block:1px solid var(--line); background:var(--panel); }
    ul { list-style:none; padding:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
    a { display:flex; align-items:center; justify-content:center; min-height:3.3rem; flex-wrap:wrap; gap:.42rem; padding:.45rem .2rem; text-align:center; font-size:.86rem; font-weight:700; text-decoration:none; color:var(--text); }
    a:hover { text-decoration:underline; }
    .icon { color:var(--amber); }
    @media (min-width:44rem) { ul { grid-template-columns:repeat(4,minmax(0,1fr)); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrustStrip {
  protected readonly items = [
    { label: 'Cash on Delivery', icon: 'icon-lock', link: '/policies/shipping', fragment: 'payment' },
    { label: 'Safe packaging', icon: 'icon-box', link: '/policies/shipping', fragment: 'packaging' },
    { label: 'Easy returns', icon: 'icon-cart', link: '/policies/returns' },
    { label: 'Authentic models', icon: 'icon-shield', link: '/about' },
  ];
}
