import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { apiMessage } from '../api-message';
import { AdminSessionStore } from './admin-session-store';
import { adminAuthApi } from './admin.config';

@Component({
  selector: 'app-admin-totp-setup',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="setup-heading" class="admin-panel">
      <h2 id="setup-heading">Authenticator setup</h2>
      @if (recoveryCodes().length) {
        <p role="status">
          Authenticator enabled. Save these one-time recovery codes somewhere secure before
          continuing.
        </p>
        <ul class="recovery-codes">
          @for (code of recoveryCodes(); track code) {
            <li>
              <code>{{ code }}</code>
            </li>
          }
        </ul>
        <button type="button" class="primary-button" (click)="completed.emit()">
          I saved the codes
        </button>
      } @else if (enrollment(); as setup) {
        <p>Scan the QR code in your authenticator app, then enter its current six-digit code.</p>
        <img
          width="200"
          height="200"
          [src]="setup.qrCode"
          alt="Scan to add Apaar Garage to your authenticator"
        />
        <details>
          <summary>Enter the key manually</summary>
          <code>{{ setup.secret }}</code>
        </details>
        <form (submit)="confirm($event, code.value)">
          <label for="setup-code">Authenticator code</label>
          <input
            #code
            id="setup-code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
            pattern="[0-9]{6}"
            maxlength="6"
          />
          <button type="submit" class="primary-button" [disabled]="busy()">
            Enable authenticator
          </button>
        </form>
      } @else {
        <button type="button" class="primary-button" [disabled]="busy()" (click)="begin()">
          Generate setup QR code
        </button>
      }
      @if (error()) {
        <p class="error-text" role="alert">{{ error() }}</p>
      }
    </section>
  `,
})
export class AdminTotpSetup {
  readonly completed = output();
  private readonly sessions = inject(AdminSessionStore);
  protected readonly enrollment = signal<{ secret: string; qrCode: string } | null>(null);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async begin() {
    await this.run(async () =>
      this.enrollment.set(
        await this.sessions.request<{ secret: string; qrCode: string }>(
          'POST',
          adminAuthApi + '/2fa/setup',
          {},
        ),
      ),
    );
  }

  protected async confirm(event: Event, code: string) {
    event.preventDefault();
    await this.run(async () => {
      this.recoveryCodes.set(await this.sessions.confirmEnrollment(code));
      this.enrollment.set(null);
    });
  }

  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(apiMessage(error, 'Authenticator setup failed. Try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
