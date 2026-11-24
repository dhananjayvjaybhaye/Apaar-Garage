import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';
import { AuthStore } from './auth-store';

@Component({
  selector: 'app-account-privacy',
  imports: [RouterLink],
  template: `
    <main class="container account-privacy">
      <h1>Account privacy</h1>
      <section aria-labelledby="download-title">
        <h2 id="download-title">Download your account data</h2>
        <p>Get a copy of your profile, signed-in orders, and saved account information.</p>
        <a class="secondary-button" href="/api/account/export">Download account data</a>
      </section>
      <section aria-labelledby="close-title">
        <h2 id="close-title">Close your account</h2>
        <p>
          Finish any open orders and returns first. Closing removes your sign-in and personal
          details. Anonymized order records are kept for the store’s retention period.
        </p>
        <form (submit)="close($event, password, confirm.checked)">
          <label for="close-password">Current password</label>
          <input
            #password
            id="close-password"
            type="password"
            autocomplete="current-password"
            required
          />
          <label class="confirm"
            ><input #confirm type="checkbox" required /> I want to close my account.</label
          >
          @if (error()) {
            <p class="error-text" role="alert">{{ error() }}</p>
          }
          <button class="primary-button" type="submit" [disabled]="pending()">Close account</button>
        </form>
      </section>
      <a routerLink="/policies/privacy">Privacy policy</a>
    </main>
  `,
  styles: `
    .account-privacy {
      max-width: 44rem;
      padding-block: 2rem 5rem;
    }
    section {
      margin-block: 2rem;
    }
    form {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
    input[type='password'] {
      width: min(100%, 28rem);
      min-height: 2.75rem;
    }
    .confirm {
      display: flex;
      min-height: 2.75rem;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPrivacyPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly pending = signal(false);
  protected readonly error = signal('');

  protected async close(event: Event, password: HTMLInputElement, confirm: boolean) {
    event.preventDefault();
    if (this.pending() || !confirm) return;
    this.pending.set(true);
    this.error.set('');
    const user = this.auth.user();
    try {
      await firstValueFrom(
        this.http.post('/api/account/delete', { password: password.value, confirm }),
      );
      this.auth.expireSession(user);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(apiMessage(error, 'Your account could not be closed. Try again.'));
    } finally {
      password.value = '';
      this.pending.set(false);
    }
  }
}
