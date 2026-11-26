import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { adminAuthApi, adminCsrfHeader, adminNavigation } from './admin.config';

export interface AdminSession {
  name: string;
  email: string;
  csrfToken: string;
  expiresAt: string;
  idleUntil: string;
  serverTime: string;
  setupRequired: boolean;
  twoFactorEnabled: boolean;
  canEditSettings?: boolean;
  permissions?: readonly string[];
  hasStaff?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminSessionStore {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AdminSession | null>(null);
  readonly session = this.current.asReadonly();
  private readonly serverOffset = signal(0);
  readonly hasPermissions = computed(() => {
    const permissions = this.session()?.permissions;
    return Array.isArray(permissions) && permissions.length > 0;
  });
  readonly sections = computed(() => adminNavigation.filter(({ permission }) =>
    this.can(permission) &&
    (permission !== 'admin-users.manage' || this.session()?.hasStaff === true),
  ));

  can(permission: string) {
    const permissions = this.session()?.permissions;
    return Array.isArray(permissions) && permissions.includes(permission);
  }

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

  // Only replay requests rejected before the write reached its handler.
  async saveProduct<T>(method: 'POST' | 'PATCH', path: string, body: object) {
    const previous = this.session();
    try {
      return await this.request<T>(method, path, body);
    } catch (error) {
      if (
        !previous ||
        !(error instanceof HttpErrorResponse) ||
        error.status !== 403 ||
        error.error?.code !== 'ADMIN_CSRF_MISMATCH'
      )
        throw error;
    }

    const current = await this.request<AdminSession>('GET', adminAuthApi + '/session');
    if (current.email !== previous.email || current.setupRequired) {
      this.expire();
      throw new HttpErrorResponse({ status: 401 });
    }
    this.store(current);
    return this.request<T>(method, path, body);
  }

  async upload<T>(path: string, file: File, contentType: string) {
    const current = this.session();
    const headers = new HttpHeaders({
      'Content-Type': contentType,
      ...(current && { [adminCsrfHeader]: current.csrfToken }),
    });
    try {
      return await firstValueFrom(this.http.post<T>(path, file, { headers }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.expire();
      throw error;
    }
  }

  async download(path: string) {
    try {
      return await firstValueFrom(this.http.get(path, { responseType: 'blob' }));
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
