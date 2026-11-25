import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminSessionStore, type AdminSession } from './admin-session-store';

const productPath = '/api/admin/products';
const sessionPath = '/api/auth/admin/session';
const sampleSession = {
  name: 'Test Admin',
  email: 'admin@example.test',
  csrfToken: 'original-token',
  setupRequired: false,
  twoFactorEnabled: true,
  serverTime: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  idleUntil: new Date().toISOString(),
} satisfies AdminSession;

async function adminSession() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const store = TestBed.inject(AdminSessionStore);
  const http = TestBed.inject(HttpTestingController);
  const restoring = store.restore();
  http.expectOne(sessionPath).flush(sampleSession);
  await restoring;
  return { store, http };
}

describe('Admin session store', () => {
  it('renews a stale CSRF token and retries a rejected create exactly once', async () => {
    const { store, http } = await adminSession();
    const draft = { name: 'Keep this draft' };
    const saving = store.saveProduct('POST', productPath, draft);
    const first = http.expectOne(productPath);
    expect(first.request.headers.get('X-Admin-CSRF')).toBe('original-token');
    first.flush({ code: 'ADMIN_CSRF_MISMATCH' }, { status: 403, statusText: 'Forbidden' });
    const session = await vi.waitFor(() => http.expectOne(sessionPath));
    session.flush({ ...sampleSession, csrfToken: 'new-token' });
    const retry = await vi.waitFor(() => http.expectOne(productPath));
    expect(retry.request.headers.get('X-Admin-CSRF')).toBe('new-token');
    expect(retry.request.body).toEqual(draft);
    retry.flush({ slug: 'draft' }, { status: 201, statusText: 'Created' });
    await expect(saving).resolves.toEqual({ slug: 'draft' });
    http.verify();
  });

  it('never resends a draft for a different account or after a network failure', async () => {
    const { store, http } = await adminSession();
    const draft = { name: 'Keep this draft' };
    const offline = store.saveProduct('POST', productPath, draft);
    http.expectOne(productPath).error(new ProgressEvent('error'));
    await expect(offline).rejects.toMatchObject({ status: 0 });
    const saving = store.saveProduct('POST', productPath, draft);
    http
      .expectOne(productPath)
      .flush({ code: 'ADMIN_CSRF_MISMATCH' }, { status: 403, statusText: 'Forbidden' });
    const session = await vi.waitFor(() => http.expectOne(sessionPath));
    session.flush({ ...sampleSession, email: 'other@example.test' });
    await expect(saving).rejects.toMatchObject({ status: 401 });
    http.verify();
  });

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
