import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ShopLoading, ShopState } from '../ui/shop-state';

interface Invoice {
  invoiceType: 'tax_invoice' | 'bill_of_supply';
  invoiceNumber: string;
  issuedAt: string;
  seller: { name: string; address?: string; state: string; gstin?: string };
  items: {
    slug: string;
    sku?: string;
    hsn?: string;
    name: string;
    quantity: number;
    unitPricePaise: number;
    discountPaise?: number;
  }[];
  taxBreakup?: {
    gstRatePercent: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
  }[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  totalPaise: number;
}

@Component({
  selector: 'app-order-invoice',
  imports: [CurrencyPipe, DatePipe, RouterLink, ShopLoading, ShopState],
  template: `
    <main class="container invoice">
      @if (invoice.hasValue()) {
        @let bill = invoice.value();
        <h1>{{ bill.invoiceType === 'tax_invoice' ? 'Tax invoice' : 'Bill of supply' }}</h1>
        <p>{{ bill.invoiceNumber }} · {{ bill.issuedAt | date: 'mediumDate' : '+0530' }}</p>
        <h2>{{ bill.seller.name }}</h2>
        <p>{{ bill.seller.address }} {{ bill.seller.state }}</p>
        @if (bill.seller.gstin) {
          <p>GSTIN {{ bill.seller.gstin }}</p>
        }
        <h2>Items</h2>
        <ul>
          @for (item of bill.items; track item.slug) {
            <li>
              {{ item.name }} × {{ item.quantity }} ·
              {{ item.unitPricePaise / paisePerRupee | currency: 'INR' }} each
            </li>
          }
        </ul>
        @if (bill.taxBreakup?.length) {
          <h2>Included taxes</h2>
          <ul>
            @for (tax of bill.taxBreakup; track tax.gstRatePercent) {
              <li>
                <strong>GST {{ tax.gstRatePercent }}%</strong>
                @if (tax.igstPaise) {
                  · IGST {{ tax.igstPaise / paisePerRupee | currency: 'INR' }}
                } @else if (tax.cgstPaise || tax.sgstPaise) {
                  · CGST {{ tax.cgstPaise / paisePerRupee | currency: 'INR' }} · SGST
                  {{ tax.sgstPaise / paisePerRupee | currency: 'INR' }}
                }
              </li>
            }
          </ul>
        }
        <p>Merchandise {{ bill.subtotalPaise / paisePerRupee | currency: 'INR' }}</p>
        @if (bill.discountPaise) {
          <p>Discount {{ bill.discountPaise / paisePerRupee | currency: 'INR' }}</p>
        }
        @if (bill.shippingPaise) {
          <p>Delivery {{ bill.shippingPaise / paisePerRupee | currency: 'INR' }}</p>
        }
        @if (bill.codFeePaise) {
          <p>COD fee {{ bill.codFeePaise / paisePerRupee | currency: 'INR' }}</p>
        }
        <p>
          <strong>Order total {{ bill.totalPaise / paisePerRupee | currency: 'INR' }}</strong>
        </p>
      } @else {
        <h1>Order invoice</h1>
        @if (invoice.isLoading()) {
          <app-shop-loading label="Loading invoice…" />
        } @else {
          <app-shop-state
            title="Invoice unavailable"
            message="Open this page from the account or browser used for checkout after dispatch."
            [retryable]="true"
            (retry)="invoice.reload()"
          />
        }
      }
      @if (number(); as orderNumber) {
        <a class="secondary-button" [routerLink]="['/track-order', orderNumber]"
          >Back to tracking</a
        >
      }
    </main>
  `,
  styles: `
    .invoice {
      padding-block: 2rem 5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderInvoice {
  protected readonly paisePerRupee = 100;
  protected readonly number = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderNumber'))),
  );
  protected readonly invoice = httpResource<Invoice>(() => {
    const number = this.number();
    return number ? '/api/orders/' + encodeURIComponent(number) + '/invoice' : undefined;
  });
}
