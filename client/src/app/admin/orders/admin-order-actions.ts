import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { orderLabel, type AdminOrder } from './admin-order-types';

export interface OrderCommand {
  path: 'confirmation' | 'notes' | 'status' | 'payment';
  body: object;
  onSuccess?: () => void;
}

@Component({
  selector: 'app-admin-order-actions',
  imports: [DatePipe, FieldControl, FormField],
  templateUrl: './admin-order-actions.html',
  styles: `
    :host { display: grid; gap: .75rem; }
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    legend { font-weight: 650; padding-bottom: .5rem; }
    form + form { margin-top: 1rem; }
    li { overflow-wrap: anywhere; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderActions {
  readonly order = input.required<AdminOrder>();
  readonly busy = input(false);
  readonly command = output<OrderCommand>();
  protected readonly label = orderLabel;
  protected readonly confirmationOptions = ['confirmed', 'unreachable', 'declined'] as const;
  protected readonly deliveryFailures = ['refused', 'unreachable', 'failed_attempts'];
  protected readonly cancellationReasons = [
    ['customer_requested', 'Customer requested'],
    ['customer_declined', 'Customer declined'],
    ['customer_unreachable', 'Customer unreachable'],
    ['stock_unavailable', 'Stock unavailable'],
    ['other', 'Other'],
  ];

  protected send(path: OrderCommand['path'], body: object) {
    if (!this.busy()) this.command.emit({ path, body });
  }

  protected submit(event: Event, command: OrderCommand) {
    event.preventDefault();
    if (!this.busy()) this.command.emit(command);
  }

  protected addNote(event: Event, field: HTMLTextAreaElement) {
    this.submit(event, {
      path: 'notes',
      body: { note: field.value.trim() },
      onSuccess: () => { field.value = ''; },
    });
  }

  protected ship(event: Event, courier: string, awb: string, trackingUrl: string) {
    const shipment = {
      ...(courier.trim() && { courier: courier.trim() }),
      ...(awb.trim() && { awb: awb.trim() }),
      ...(trackingUrl.trim() && { trackingUrl: trackingUrl.trim() }),
    };
    this.submit(event, { path: 'status', body: { status: 'shipped', shipment } });
  }
}
