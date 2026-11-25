import { inject, signal } from '@angular/core';
import { apiMessage } from '../api-message';
import { AdminSessionStore } from './admin-session-store';

export function adminAction() {
  const sessions = inject(AdminSessionStore);
  const busy = signal(false);
  const error = signal('');
  const notice = signal('');
  return {
    busy, error, notice,
    async run<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body: object,
      message: string, onSuccess: (value: T) => void) {
      if (busy()) return;
      busy.set(true);
      error.set('');
      notice.set('');
      try {
        const value = await sessions.request<T>(method, path, body);
        onSuccess(value);
        notice.set(message);
      } catch (failure) {
        error.set(apiMessage(failure, 'Could not save the change. Please retry.'));
      } finally {
        busy.set(false);
      }
    },
  };
}
