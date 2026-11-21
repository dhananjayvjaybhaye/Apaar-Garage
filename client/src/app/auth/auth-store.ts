import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface Account {
  id: string;
  name: string;
  email: string;
}

interface Credentials {
  email: string;
  password: string;
}

type Session =
  { status: 'checking' | 'signed-out' | 'unavailable' } | { status: 'signed-in'; user: Account };

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly session = signal<Session>({ status: 'checking' });
  private restoration?: Promise<void>;
  private version = 0;

  readonly status = computed(() => this.session().status);
  readonly user = computed(() => {
    const session = this.session();
    return session.status === 'signed-in' ? session.user : null;
  });

  ensureSession() {
    const status = this.status();
    if (status === 'signed-in' || status === 'signed-out') return Promise.resolve();
    return (this.restoration ??= this.restore());
  }

  async login(credentials: Credentials) {
    const user = await firstValueFrom(this.http.post<Account>('/api/auth/login', credentials));
    this.setSession({ status: 'signed-in', user });
  }

  async register(data: Credentials & { name: string }) {
    const user = await firstValueFrom(this.http.post<Account>('/api/auth/register', data));
    this.setSession({ status: 'signed-in', user });
  }

  async logout() {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.setSession({ status: 'signed-out' });
  }

  expireSession(user: Account | null) {
    if (user && this.user() === user) {
      this.setSession({ status: 'signed-out' });
    }
  }

  private async restore() {
    const version = this.version;
    this.session.set({ status: 'checking' });
    try {
      const user = await firstValueFrom(this.http.get<Account | null>('/api/auth/me?optional=true'));
      if (this.version === version) this.setSession(user ? { status: 'signed-in', user } : { status: 'signed-out' });
    } catch (error) {
      if (this.version === version) {
        const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
        this.setSession({ status: unauthorized ? 'signed-out' : 'unavailable' });
      }
    } finally {
      this.restoration = undefined;
    }
  }

  private setSession(session: Session) {
    this.version++;
    this.session.set(session);
  }
}
