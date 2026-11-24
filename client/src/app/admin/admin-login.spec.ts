import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminSessionStore, type AdminSession } from './admin-session-store';
import { adminRoutes } from './admin.routes';

const setupSession: AdminSession = {
  name: 'Test Admin',
  email: 'admin@example.test',
  csrfToken: 'test-only-token',
  expiresAt: new Date(0).toISOString(),
  idleUntil: new Date(0).toISOString(),
  serverTime: new Date(0).toISOString(),
  setupRequired: true,
  twoFactorEnabled: false,
};

function configure(initial: AdminSession | null) {
  const session = signal(initial);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'admin', children: adminRoutes }]),
      {
        provide: AdminSessionStore,
        useValue: {
          session,
          restore: vi.fn(async () => session()),
          request: vi.fn(async () => ({
            secret: 'SETUPKEY',
            qrCode: 'data:image/png;base64,AA==',
          })),
          confirmEnrollment: vi.fn(async () => {
            session.set({ ...setupSession, setupRequired: false, twoFactorEnabled: true });
            return ['TEST-RECOVERY-CODE'];
          }),
        },
      },
    ],
  });
}

describe('Admin sign-in routing', () => {
  it('redirects a visitor without an admin session to admin sign-in', async () => {
    configure(null);
    const harness = await RouterTestingHarness.create('/admin');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Administrator sign-in',
    );
  });

  it('keeps recovery codes visible after mandatory enrollment succeeds', async () => {
    configure(setupSession);
    const harness = await RouterTestingHarness.create('/admin');
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement!;
    page.querySelector<HTMLButtonElement>('app-admin-totp-setup button')!.click();
    await harness.fixture.whenStable();
    expect(page.querySelector('app-admin-totp-setup img')).toBeTruthy();
    const code = page.querySelector<HTMLInputElement>('#setup-code')!;
    code.value = '123456';
    code.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    expect(page.querySelector('.recovery-codes')?.textContent).toContain('TEST-RECOVERY-CODE');
  });
});
