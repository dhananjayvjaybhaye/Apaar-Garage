import { DatePipe, TitleCasePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { apiMessage } from '../api-message';
import { ShopLoading, ShopState } from '../ui/shop-state';
import { type CustomerOrder, type OrderStatus, OrdersApi } from './orders-api';
import { orderStatusLabel } from './order-status-label';

const interrupted: OrderStatus[] = ['cancelled', 'returned', 'undelivered', 'returned_to_seller'];

const stages = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'] as const;

@Component({
  selector: 'app-order-tracking',
  imports: [DatePipe, TitleCasePipe, RouterLink, ShopLoading, ShopState],
  template: `
    <main class="container tracking">
      <h1>Track order</h1>
      @if (order.isLoading()) { <app-shop-loading label="Loading tracking…" /> }
      @else if (order.hasValue()) {
        @let current = order.value();
        <p><strong>{{ current.orderNumber }}</strong> · {{ statusLabel(current.status) | titlecase }}</p>
        @if (stagesInProgress()) { <p>{{ current.deliveryEstimate }}</p> }
        <ol aria-label="Order status timeline">
          @for (entry of timeline(); track entry.status) {
            <li [class.reached]="entry.reached" [attr.aria-current]="entry.status === current.status ? 'step' : null">
              <strong>{{ statusLabel(entry.status) | titlecase }}</strong>
              @if (entry.at) { <time [attr.datetime]="entry.at">{{ entry.at | date: 'medium' }}</time> }
              @else if (!entry.reached) { <span>Upcoming</span> }
            </li>
          }
        </ol>
        @if (current.shipment?.courier; as courier) { <p>Courier {{ courier }} · {{ current.shipment?.awb }}</p> }
        @if (current.shipment?.trackingUrl; as url) { <p><a [href]="url" rel="noopener noreferrer">Track with courier</a></p> }
        @if (current.invoiceNumber) { <p><a [routerLink]="['/track-order', current.orderNumber, 'invoice']">View invoice or bill</a></p> }
        @if (current.guest && current.canCancel) {
          @if (confirmCancel()) {
            <p>Cancel this order?</p>
            <button class="secondary-button" type="button" [disabled]="cancelling()" (click)="confirmCancel.set(false)">Keep order</button>
            <button class="primary-button" type="button" [disabled]="cancelling()" (click)="cancel(current.orderNumber)">Confirm cancellation</button>
          } @else {
            <button class="secondary-button" type="button" (click)="confirmCancel.set(true)">Cancel order</button>
          }
        }
        @if (cancelError()) { <p class="error-text" role="alert">{{ cancelError() }}</p> }
        @if (current.guest) {
          <p class="muted">Bookmark this page to track your order from this browser.</p>
        } @else {
          <a class="secondary-button" routerLink="/orders">Order history</a>
        }
        <button class="secondary-button refresh" type="button" (click)="order.reload()">Refresh tracking</button>
      } @else {
        <app-shop-state title="Tracking unavailable" [message]="failure()" [retryable]="true" (retry)="order.reload()" />
      }
    </main>
  `,
  styles: `
    .tracking { padding-block:2rem 5rem; }
    ol { padding-left:0; list-style:none; }
    li { position:relative; display:grid; gap:.2rem; padding:0 0 1.25rem 1.25rem; border-left:2px solid var(--line); }
    li::before { content:''; position:absolute; left:-.4rem; top:.28rem; width:.7rem; aspect-ratio:1; border-radius:50%; background:#848891; }
    li.reached::before { background:var(--accent, #ec4747); }
    li[aria-current] strong { text-decoration:underline; }
    time, li span { color:var(--muted); }
    .refresh { margin-left:.5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderTracking {
  private readonly api = inject(OrdersApi);
  protected readonly confirmCancel = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal('');
  private readonly number = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderNumber'))));
  protected readonly order = httpResource<CustomerOrder>(() => {
    const number = this.number();
    return number ? '/api/orders/' + encodeURIComponent(number) : undefined;
  });

  protected readonly statusLabel = orderStatusLabel;
  protected readonly stagesInProgress = computed(() => {
    const status = this.order.hasValue() ? this.order.value().status : undefined;
    return status !== undefined && !interrupted.includes(status) && status !== 'delivered';
  });

  protected readonly timeline = computed(() => {
    if (!this.order.hasValue()) return [];
    const order = this.order.value();
    const dates = new Map((order.statusHistory ?? []).map(({ status, at }) => [status, at]));
    const status = order.status;
    const currentIndex = status === 'returned' ? stages.length - 1 : stages.findIndex((stage) => stage === status);
    if (status === 'undelivered' || status === 'returned_to_seller') {
      const failedPath: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'undelivered'];
      if (status === 'returned_to_seller') failedPath.push(status);
      return failedPath.map((step) => ({ status: step, at: dates.get(step), reached: true }));
    }
    if (status === 'cancelled' || status === 'returned') {
      const completed = stages.filter((stage, index) => dates.has(stage) || index === 0 || index <= currentIndex);
      return [...completed, status].map((step) => ({ status: step, at: dates.get(step), reached: true }));
    }
    return stages.map((step, index) => ({ status: step, at: dates.get(step), reached: index <= currentIndex }));
  });

  protected async cancel(orderNumber: string) {
    this.cancelling.set(true);
    this.cancelError.set('');
    try {
      this.order.set(await firstValueFrom(this.api.cancel(orderNumber)));
      this.confirmCancel.set(false);
    } catch (error) {
      this.cancelError.set(apiMessage(error, 'The order could not be cancelled.'));
    } finally {
      this.cancelling.set(false);
    }
  }

  protected failure() {
    return apiMessage(this.order.error(), 'Tracking could not load. Try again from the browser used for checkout.');
  }
}
