import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, fromEvent, interval, merge, throttleTime } from 'rxjs';
import { apiMessage } from '../api-message';
import { BrandLogo } from '../ui/brand-logo';
import { AdminProductDrafts } from './products/admin-product-drafts';
import { AdminSessionStore } from './admin-session-store';
import {
  activityThrottleMs,
  adminLoginPath,
  adminNavigation,
  adminProductEditorReturn,
  sessionClockMs,
  warningMs,
} from './admin.config';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, BrandLogo],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  private readonly router = inject(Router);
  private readonly productDrafts = inject(AdminProductDrafts);
  protected readonly sessions = inject(AdminSessionStore);
  protected readonly navigation = adminNavigation;
  protected readonly menuOpen = signal(false);
  private readonly now = signal(Date.now());
  private readonly remaining = computed(() => this.sessions.remainingMs(this.now()));
  protected readonly absoluteSoon = computed(
    () => this.sessions.absoluteRemainingMs(this.now()) <= warningMs,
  );
  protected readonly warning = computed(() => this.remaining() <= warningMs);
  protected readonly sessionError = signal('');
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
          queryParams: this.explicitLogout()
            ? {}
            : {
                expired: 1,
                returnTo: adminProductEditorReturn(this.router.url),
              },
          replaceUrl: true,
        });
      }
    });
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
      this.productDrafts.clear();
    } catch (error) {
      this.explicitLogout.set(false);
      this.sessionError.set(apiMessage(error, 'Could not sign out. Try again.'));
    }
  }
}
