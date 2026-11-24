import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { adminAuthApi, adminCsrfHeader } from './admin.config';

export interface AdminSession {
  name: string;
  email: string;
  csrfToken: string;
  expiresAt: string;
  idleUntil: string;
  serverTime: string;
  setupRequired: boolean;
  twoFactorEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminSessionStore {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AdminSession | null>(null);
  readonly session = this.current.asReadonly();
  private readonly serverOffset = signal(0);

  private store(session: AdminSession) {
    this.serverOffset.set(Date.parse(session.serverTime) - Date.now());
    this.current.set(session);
    return session;
  }

  remainingMs(at: number) {
    const session = this.session();
    if (!session) return 0;
    return Math.max(
      0,
      Math.min(Date.parse(session.idleUntil), Date.parse(session.expiresAt)) -
        at -
        this.serverOffset(),
    );
  }

  absoluteRemainingMs(at: number) {
    const session = this.session();
    return session ? Math.max(0, Date.parse(session.expiresAt) - at - this.serverOffset()) : 0;
  }

  async restore() {
    try {
      return this.store(
        await firstValueFrom(this.http.get<AdminSession>(adminAuthApi + '/session')),
      );
    } catch {
      this.expire();
      return null;
    }
  }

  async login(email: string, password: string, code: string) {
    return this.store(
      await firstValueFrom(
        this.http.post<AdminSession>(adminAuthApi + '/login', {
          email,
          password,
          ...(code.trim() && { code: code.trim() }),
        }),
      ),
    );
  }

  async request<T>(method: string, path: string, body?: object) {
    const csrf = this.session()?.csrfToken;
    const headers =
      csrf && method !== 'GET' ? new HttpHeaders({ [adminCsrfHeader]: csrf }) : undefined;
    try {
      return await firstValueFrom(this.http.request<T>(method, path, { headers, body }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.expire();
      throw error;
    }
  }

  async activity() {
    const current = this.session();
    const renewed = await this.request<AdminSession>('POST', adminAuthApi + '/activity', {});
    if (this.session() === current) this.store(renewed);
  }

  async confirmEnrollment(code: string) {
    const response = await this.request<AdminSession & { recoveryCodes: string[] }>(
      'POST',
      adminAuthApi + '/2fa/confirm',
      { code },
    );
    const { recoveryCodes, ...session } = response;
    this.store(session);
    return recoveryCodes;
  }

  async logout() {
    await this.request('POST', adminAuthApi + '/logout', {});
    this.expire();
  }

  expire() {
    this.current.set(null);
  }
}
