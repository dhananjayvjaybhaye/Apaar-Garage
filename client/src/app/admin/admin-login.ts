import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { AdminSessionStore } from './admin-session-store';
import { AdminTotpSetup } from './admin-totp-setup';
import { adminDashboardPath } from './admin.config';

@Component({
  selector: 'app-admin-login',
  imports: [RouterLink, AdminTotpSetup],
  templateUrl: './admin-login.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLogin {
  protected readonly sessions = inject(AdminSessionStore);
  private readonly router = inject(Router);
  protected readonly checking = signal(true);
  protected readonly enrolling = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.get('expired') === '1';

  constructor() {
    void this.restore();
  }

  private async restore() {
    const session = await this.sessions.restore();
    this.checking.set(false);
    if (session?.setupRequired) this.enrolling.set(true);
    else if (session) this.openDashboard();
  }

  protected async signIn(
    event: Event,
    email: string,
    password: HTMLInputElement,
    code: HTMLInputElement,
  ) {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const session = await this.sessions.login(email, password.value, code.value);
      if (session.setupRequired) this.enrolling.set(true);
      else this.openDashboard();
    } catch (error) {
      this.error.set(apiMessage(error, 'Administrator sign-in failed. Try again.'));
    } finally {
      password.value = '';
      code.value = '';
      this.busy.set(false);
    }
  }

  protected openDashboard() {
    void this.router.navigateByUrl(adminDashboardPath, { replaceUrl: true });
  }

  protected async cancelSetup() {
    try {
      await this.sessions.logout();
    } catch (error) {
      this.error.set(apiMessage(error, 'Your session could not be closed. Try again.'));
    }
  }
}
