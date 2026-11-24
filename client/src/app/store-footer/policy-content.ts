import type { StoreInfo } from './store-info';
import { suppliedText } from './store-info';

export type Policy = 'about' | 'shipping' | 'returns' | 'privacy' | 'terms';
interface Section {
  id: string;
  heading: string;
  text: string;
}

export function policyContent(
  policy: Policy,
  info: StoreInfo | undefined,
): { title: string; sections: Section[] } {
  const details = info?.policyDetails;
  const field = (value: string | null | undefined, placeholder: string) =>
    suppliedText(value) ?? placeholder;
  const section = (id: string, heading: string, text: string) => ({ id, heading, text });
  const cancellation = section(
    'cancel',
    'Cancellation',
    'Customers can cancel while the order is Placed or Confirmed. Use order history or the guest tracking link from the browser used at checkout. Once the order is packed, contact customer care for help. Shipped orders can’t be cancelled through the store.',
  );
  const failedCod = section(
    'failed-cod',
    'Refused or unreachable COD parcels',
    'If a parcel is refused or can’t be delivered, it may be returned to the seller. Repeated failed deliveries can lead to a confirmation request or limit future Cash on Delivery orders. If you no longer need an order, cancel it before packing or contact customer care.',
  );
  const exchange = section(
    'exchange',
    'Exchange and warranty',
    field(details?.exchangeTerms, 'Exchange eligibility and timing to be supplied.') +
      ' Check the warranty shown on the product page. ' +
      field(details?.warrantyTerms, 'Warranty coverage and claim instructions to be supplied.'),
  );

  switch (policy) {
    case 'shipping':
      return {
        title: 'Shipping',
        sections: [
          section(
            'delivery',
            'Delivery timelines',
            'Use the pincode check on the product page for an estimate. ' +
              field(info?.deliveryEstimate, 'General delivery estimate to be supplied.') +
              ' Checkout shows the applicable fees and estimate before you place your order.',
          ),
          section(
            'tracking',
            'Tracking your shipment',
            'Open Track order from your confirmation or order history. For guest orders, use the browser where you checked out. Courier tracking appears once it is available.',
          ),
          section(
            'cod',
            'Cash on Delivery',
            'Where available, pay the checkout total in cash when the order arrives. We may call or message you on WhatsApp to confirm your order.',
          ),
          failedCod,
          section(
            'battery',
            'Battery shipping and RC safety',
            'Check the product’s battery shipping notes before ordering. Availability can vary by route. Follow the manufacturer’s age, supervision, battery, and charging instructions. Use a compatible charger and stop using a damaged or swollen battery.',
          ),
          cancellation,
        ],
      };
    case 'returns': {
      const days = info?.defaultReturnWindowDays;
      const window =
        days == null
          ? 'Default return window to be supplied.'
          : days === 0
            ? 'No standard store-wide return window is listed.'
            : 'The store’s default return window is ' + days + ' days from delivery.';
      return {
        title: 'Returns',
        sections: [
          section(
            'return-window',
            'Return window and conditions',
            window +
              ' Check the product page for its specific window. Open a support ticket with the order number and item details. ' +
              field(details?.returnConditions, 'Return conditions to be supplied.'),
          ),
          section(
            'non-returnable',
            'Non-returnable items',
            field(
              details?.nonReturnableItems,
              'The list of non-returnable items is to be supplied. If an item arrived damaged or incorrect, contact us so we can review your claim.',
            ),
          ),
          section(
            'claims',
            'Damaged or wrong item claims',
            'Keep the item and packaging. Include your order number, photos, and an unboxing video if you have one. If you don’t have a video, send the evidence available and tell us what happened. Wait for return instructions before shipping the item back.',
          ),
          section(
            'refunds',
            'Refund method and timeline',
            'Approved COD refunds are handled by bank transfer or UPI. Follow the refund instructions from customer care and never share an OTP or UPI PIN. ' +
              field(details?.refundTimeline, 'Refund processing timeline to be supplied.'),
          ),
          exchange,
          cancellation,
        ],
      };
    }
    case 'privacy':
      return {
        title: 'Privacy',
        sections: [
          section(
            'account',
            'Data we collect and why',
            'We use contact, delivery, account, and order details to fulfil orders, handle returns, prevent abuse, and answer support requests. Passwords are stored as hashes. Saved addresses and wishlists are linked to your account. Verified reviews show the submitted rating and text.',
          ),
          section(
            'browser',
            'Cookies and browser storage',
            'Session cookies keep you signed in or link a guest cart and order to your browser. Browser storage can remember your guest wishlist, recent views, and stock alerts.',
          ),
          section(
            'retention',
            'Retention',
            (info?.orderRetentionDays != null
              ? 'After account closure, anonymized order records become eligible for deletion ' +
                info.orderRetentionDays +
                ' days after the order date.'
              : 'Order-record retention period to be supplied.') +
              ' ' +
              field(
                details?.otherDataRetention,
                'Retention periods for other information are to be supplied.',
              ),
          ),
          section(
            'sharing',
            'Couriers and email providers',
            'Couriers receive the contact and delivery information needed to deliver or return parcels. When order email is enabled, the email provider processes the recipient address and order update. Newsletter signup records consent and you can unsubscribe.',
          ),
          section(
            'rights',
            'Access, correct, or delete your information',
            'Sign in to download your linked account data or close your account after open orders and returns finish. Contact us to request corrections or help with guest records.',
          ),
          section(
            'children',
            'Children’s data',
            'The storefront is intended for purchases by adults. A parent or guardian should place orders for a child. If you think a child submitted personal information, contact us so we can review it.',
          ),
          section(
            'grievance',
            'Privacy and grievance contact',
            'Open Seller information for the grievance officer’s contact details. Use the contact form to raise a privacy complaint and keep the ticket number to track it.',
          ),
        ],
      };
    case 'terms':
      return {
        title: 'Store terms',
        sections: [
          section(
            'orders',
            'Orders and availability',
            'Use accurate contact and delivery details. Prices are in Indian rupees. Stock and totals are checked when you place an order. Checkout shows the final total and any applicable GST already included in merchandise prices.',
          ),
          section(
            'discounts',
            'Discounts and coupons',
            'A coupon replaces the automatic first-order discount on that order. Free delivery eligibility uses the merchandise subtotal after discounts.',
          ),
          failedCod,
          cancellation,
          section(
            'returns',
            'Returns and exchanges',
            'Review the Returns policy and the product’s return window before ordering. Submit a support ticket for a damaged or wrong item, return, or warranty claim.',
          ),
          section(
            'safety',
            'Product use and safety',
            'Check the product age grade and follow the manufacturer’s instructions, including the battery and RC safety notes where applicable.',
          ),
          section(
            'reviews',
            'Product reviews',
            'Share your experience with the model. Reviews are limited to one per product per verified buyer after delivery.',
          ),
        ],
      };
    case 'about':
      return {
        title: 'About Apaar Garage',
        sections: [
          section(
            'store',
            'For diecast and RC collectors',
            'Apaar Garage brings together scale cars, trucks, bikes, and RC toys. Browse by category, brand, or scale for your collection.',
          ),
          section(
            'models',
            'Know what you’re buying',
            'Check the maker, scale, and specifications on each listing. Sample listings identify demonstration data. Verified buyer reviews come from customers whose order was delivered.',
          ),
        ],
      };
  }
}
