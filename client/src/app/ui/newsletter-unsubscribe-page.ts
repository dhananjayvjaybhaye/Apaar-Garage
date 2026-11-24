import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';

@Component({
  selector: 'app-newsletter-unsubscribe',
  imports: [RouterLink],
  template: `
    <main class="container unsubscribe">
      <h1>Newsletter unsubscribe</h1>
      @if (done()) {
        <p role="status">
          If this link matches an active subscription, newsletter emails will stop.
        </p>
      } @else if (token()) {
        <p>Stop receiving Apaar Garage newsletter emails.</p>
        <button type="button" class="primary-button" [disabled]="pending()" (click)="unsubscribe()">
          {{ pending() ? 'Updating…' : 'Unsubscribe' }}
        </button>
        @if (error()) {
          <p role="alert" class="error-text">{{ error() }}</p>
        }
      } @else {
        <p>
          Use the unsubscribe link in a newsletter email, or send a privacy ticket with the email
          address you signed up with.
        </p>
      }
      <a class="secondary-button" routerLink="/contact" [queryParams]="{ category: 'privacy' }"
        >Contact customer care</a
      >
    </main>
  `,
  styles: `
    .unsubscribe {
      max-width: 40rem;
      padding-block: 2.5rem 5rem;
    }
    a {
      margin-block-start: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterUnsubscribePage {
  private readonly http = inject(HttpClient);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  protected readonly token = computed(() => {
    const token = this.fragment();
    return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  });
  protected readonly pending = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');

  protected async unsubscribe() {
    const token = this.token();
    if (!token || this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/newsletter/unsubscribe/' + token, {}));
      this.done.set(true);
    } catch (error) {
      this.error.set(apiMessage(error, 'Your subscription could not be updated. Try again.'));
    } finally {
      this.pending.set(false);
    }
  }
}
