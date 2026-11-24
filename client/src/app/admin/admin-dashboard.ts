import { DatePipe, JsonPipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { filter, fromEvent, interval, merge, throttleTime } from 'rxjs';
import { apiMessage } from '../api-message';
import { AdminSessionStore } from './admin-session-store';
import { AdminTotpSetup } from './admin-totp-setup';
import { activityThrottleMs, adminLoginPath, sessionClockMs, warningMs } from './admin.config';

interface AuditEntry {
  _id: string;
  who?: string;
  action: string;
  target?: string;
  ip?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, JsonPipe, RouterLink, AdminTotpSetup],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private readonly router = inject(Router);
  protected readonly sessions = inject(AdminSessionStore);
  protected readonly now = signal(Date.now());
  protected readonly remaining = computed(() => this.sessions.remainingMs(this.now()));
  protected readonly absoluteSoon = computed(
    () => this.sessions.absoluteRemainingMs(this.now()) <= warningMs,
  );
  protected readonly warning = computed(() => this.remaining() <= warningMs);
  protected readonly loading = signal(true);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly error = signal('');
  protected readonly sessionError = signal('');
  protected readonly setup = signal(false);
  protected readonly renewing = signal(false);
  private readonly explicitLogout = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    interval(sessionClockMs)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
    merge(
      fromEvent(document, 'pointerdown'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'wheel', { passive: true }),
    )
      .pipe(
        filter(() => document.visibilityState === 'visible' && Boolean(this.sessions.session())),
        throttleTime(activityThrottleMs),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.staySignedIn());
    effect(() => {
      if (!this.sessions.session() || (!this.renewing() && this.remaining() <= 0)) {
        this.sessions.expire();
        void this.router.navigate([adminLoginPath], {
          queryParams: this.explicitLogout() ? {} : { expired: 1 },
          replaceUrl: true,
        });
      }
    });
    void this.refreshAudit();
  }

  protected async refreshAudit() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.sessions.request<{ items: AuditEntry[] }>(
        'GET',
        '/api/admin/overview/audit',
      );
      this.entries.set(result.items);
    } catch (error) {
      this.error.set(apiMessage(error, 'Audit activity could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async staySignedIn() {
    if (this.renewing()) return;
    this.renewing.set(true);
    this.sessionError.set('');
    try {
      await this.sessions.activity();
      this.now.set(Date.now());
    } catch (error) {
      this.sessionError.set(apiMessage(error, 'Could not extend your session. Try again.'));
    } finally {
      this.renewing.set(false);
    }
  }

  protected async signOut() {
    this.explicitLogout.set(true);
    try {
      await this.sessions.logout();
    } catch (error) {
      this.explicitLogout.set(false);
      this.sessionError.set(apiMessage(error, 'Could not sign out. Try again.'));
    }
  }
}
