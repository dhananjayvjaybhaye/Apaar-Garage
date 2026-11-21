import { Reveal } from '../reveal';
import { Magnetic } from '../motion/magnetic';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

interface InfoPage {
  title: string;
  sections: { id: string; heading: string; text: string }[];
}

const pages: Record<string, InfoPage> = {
  about: {
    title: 'About Apaar Garage',
    sections: [
      { id: 'store', heading: 'For diecast collectors', text: 'Apaar Garage brings together scale cars, trucks, and bikes. Browse by brand or scale to find models that fit your collection.' },
      { id: 'models', heading: 'Know what you’re buying', text: 'Check the maker, scale, and specifications on each listing. Where a listing uses sample imagery, the product details describe the model you’re ordering. Verified buyer reviews come from customers whose order was delivered.' },
    ],
  },
  shipping: {
    title: 'Shipping',
    sections: [
      { id: 'delivery', heading: 'Delivery estimates', text: 'Enter an Indian pincode on the product page to check delivery and Cash on Delivery availability. Review your estimate, delivery fee, and any discount at checkout.' },
      { id: 'packaging', heading: 'Safe packaging', text: 'Models and display boxes are packed for transit. If a shipment arrives damaged, keep the packaging and tell us what happened using the Contact us form.' },
      { id: 'payment', heading: 'Cash on Delivery', text: 'Where COD is available, pay the checkout total in cash when the order arrives. Checkout shows any COD fee before you place the order.' },
      { id: 'tracking', heading: 'Track a shipment', text: 'Follow the order tracking link from your confirmation page or order history. For guest checkout, use the browser where you placed the order.' },
    ],
  },
  returns: {
    title: 'Returns',
    sections: [
      { id: 'request', heading: 'Request a return', text: 'Use Contact us with your order number, the model name, and the reason for the return. Keep the model, accessories, and packaging while support reviews your request.' },
      { id: 'next', heading: 'What happens next', text: 'Support will confirm the available remedy, any return shipping costs, and how to send the item back. Wait for the return instructions before posting the parcel.' },
      { id: 'cancel', heading: 'Cancel before packing', text: 'You can cancel an order while its status is Placed or Confirmed. Use the order history or the tracking link from your guest order confirmation.' },
    ],
  },
  privacy: {
    title: 'Privacy',
    sections: [
      { id: 'account', heading: 'Account and order information', text: 'We store the contact, address, and order details needed to run your account, fulfill orders, and answer support messages. Passwords are stored as hashes. Signed-in shoppers can save shipping addresses and a wishlist.' },
      { id: 'browser', heading: 'Cookies and browser storage', text: 'Session cookies keep you signed in or link a guest cart and order to your browser. Your browser can remember your theme, guest wishlist, recent views, and stock alerts.' },
      { id: 'messages', heading: 'Messages and reviews', text: 'If order emails are enabled, our transactional email provider processes the email address and the order update so it can deliver the message. Verified reviews display the rating and review text. Keep private details out of your reviews.' },
      { id: 'questions', heading: 'Privacy questions', text: 'Use Contact us for questions about your information or a request about your account.' },
    ],
  },
  terms: {
    title: 'Store terms',
    sections: [
      { id: 'orders', heading: 'Orders and availability', text: 'Use accurate contact and delivery details. Prices are shown in Indian rupees. Availability and totals are checked when you place the order.' },
      { id: 'discounts', heading: 'Discounts and coupons', text: 'Checkout checks each code and shows the discount before you place the order. A coupon replaces the automatic first-order discount on that order. Eligible first orders are based on the customer’s account order history.' },
      { id: 'reviews', heading: 'Product reviews', text: 'Share your own experience with the model. Reviews are limited to one per product for each verified buyer after delivery.' },
    ],
  },
};

@Component({
  selector: 'app-policy-page',
  imports: [Reveal, Magnetic, RouterLink],
  template: `
    <main class="container policy">
      <h1>{{ page().title }}</h1>
      @for (section of page().sections; track section.id) {
        <section appReveal [gentleReveal]="true" [id]="section.id" [attr.aria-labelledby]="section.id + '-title'">
          <h2 [id]="section.id + '-title'">{{ section.heading }}</h2>
          <p>{{ section.text }}</p>
        </section>
      }
      <div class="links">
        <a appMagnetic class="primary-button" routerLink="/faq" fragment="contact">Contact us</a>
        <a class="secondary-button" routerLink="/catalog">Browse the collection</a>
      </div>
    </main>
  `,
  styles: `
    .policy { max-width:48rem; min-height:48vh; padding-block:3rem 5rem; }
    h1 { margin:.3rem 0 1.8rem; }
    section { margin-block:1.4rem; }
    h2 { margin:0 0 .4rem; font-size:clamp(1.35rem,4vw,1.85rem); }
    p { color:var(--muted); margin:.45rem 0; }
    .links { margin-top:2rem; display:flex; flex-wrap:wrap; gap:.6rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyPage {
  protected readonly page = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => pages[data['policy']])),
    { requireSync: true },
  );
}
