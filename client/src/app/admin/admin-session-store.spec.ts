import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminSessionStore, type AdminSession } from './admin-session-store';

describe('Admin session store', () => {
  it('sends CSRF for admin writes and drops local state when the server ends the session', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const store = TestBed.inject(AdminSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const now = Date.now();
    const session: AdminSession = {
      name: 'Test Admin',
      email: 'admin@example.test',
      csrfToken: 'test-csrf',
      setupRequired: false,
      twoFactorEnabled: true,
      serverTime: new Date(now).toISOString(),
      expiresAt: new Date(now + 120_000).toISOString(),
      idleUntil: new Date(now + 60_000).toISOString(),
    };
    const loading = store.restore();
    http.expectOne('/api/auth/admin/session').flush(session);
    await loading;
    expect(store.remainingMs(now + 10_000)).toBeLessThan(51_000);
    const activity = store.activity();
    const request = http.expectOne('/api/auth/admin/activity');
    expect(request.request.headers.get('X-Admin-CSRF')).toBe('test-csrf');
    request.flush(
      { message: 'Sign in as an administrator to continue.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expect(activity).rejects.toMatchObject({ status: 401 });
    expect(store.session()).toBeNull();
    http.verify();
  });
});
