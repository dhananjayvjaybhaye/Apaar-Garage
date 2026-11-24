import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';

interface Ticket {
  ticketNumber: string;
  status: string;
  acknowledgeBy: string;
  acknowledgedAt?: string;
  dueAt: string;
  replies: { from: string; message: string; at: string }[];
}

@Component({
  selector: 'app-ticket-status',
  imports: [DatePipe, TitleCasePipe],
  template: `
    <section id="track-complaint" aria-labelledby="ticket-title" class="contact">
      <h2 id="ticket-title">Track a complaint</h2>
      <form (submit)="lookup($event, number.value, email.value)">
        <label for="ticket-number">Ticket number</label>
        <input #number id="ticket-number" [value]="ticketNumber()" required autocomplete="off" maxlength="20" />
        <label for="ticket-email">Email used to open the ticket</label>
        <input
          #email
          id="ticket-email"
          type="email"
          autocomplete="email"
          required
          maxlength="254"
        />
        <button class="secondary-button" type="submit" [disabled]="pending()">Check status</button>
      </form>
      @if (result(); as ticket) {
        <div role="status">
          <p>
            <strong>{{ ticket.ticketNumber }}</strong> · {{ ticket.status | titlecase }}
          </p>
          @if (!ticket.acknowledgedAt) {
            <p>Acknowledgement due {{ ticket.acknowledgeBy | date: 'medium' }}</p>
          }
          @if (ticket.status === 'open' || ticket.status === 'acknowledged') {
            <p>Resolution due {{ ticket.dueAt | date: 'medium' }}</p>
          }
        </div>
        @if (ticket.replies.length) {
          <ul>
            @for (reply of ticket.replies; track $index) {
              <li>
                <strong>{{ reply.from | titlecase }}</strong> · {{ reply.at | date: 'short' }}
                <p>{{ reply.message }}</p>
              </li>
            }
          </ul>
        }
      }
      @if (error()) {
        <p class="error-text" role="alert">{{ error() }}</p>
      }
    </section>
  `,
  styleUrl: './help-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketStatus {
  readonly ticketNumber = input('');
  private readonly http = inject(HttpClient);
  protected readonly result = signal<Ticket | undefined>(undefined);
  protected readonly error = signal('');
  protected readonly pending = signal(false);

  protected async lookup(event: Event, ticketNumber: string, email: string) {
    event.preventDefault();
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.result.set(undefined);
    try {
      this.result.set(
        await firstValueFrom(
          this.http.post<Ticket>('/api/support/status', { ticketNumber, email }),
        ),
      );
    } catch (error) {
      this.error.set(apiMessage(error, 'We could not look up this ticket. Try again.'));
    } finally {
      this.pending.set(false);
    }
  }
}
