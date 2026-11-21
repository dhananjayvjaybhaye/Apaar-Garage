import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { getSlugs, storeSlugs } from './browser-storage';

const url = '/api/account/wishlist';
const key = 'apaar-wishlist';

@Injectable({ providedIn: 'root' })
export class WishlistStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly guest = signal(getSlugs(key));
  private readonly account = signal<{ id: string; slugs: string[] } | null>(null);
  private readonly requestBusy = signal(false);
  private readonly syncing = signal(false);
  private readonly revision = signal(0);
  readonly loadError = signal(false);
  readonly busy = computed(() => this.requestBusy() || this.syncing());
  readonly slugs = computed(() => {
    const id = this.auth.user()?.id;
    const snapshot = this.account();
    return id ? (snapshot?.id === id ? snapshot.slugs : []) : this.guest();
  });

  constructor() {
    effect((onCleanup) => {
      this.revision();
      this.loadError.set(false);
      const id = this.auth.user()?.id;
      let active = true;
      onCleanup(() => { active = false; });
      this.account.set(null);
      if (!id) {
        this.syncing.set(false);
        return;
      }
      this.syncing.set(true);
      void this.sync(id, untracked(this.guest), () => active && this.auth.user()?.id === id);
    });
  }

  retry() { this.revision.update((value) => value + 1); }

  async toggle(slug: string) {
    if (this.busy()) return;
    const id = this.auth.user()?.id;
    if (!id) {
      const list = this.guest();
      const next = list.includes(slug) ? list.filter((item) => item !== slug) : [slug, ...list].slice(0, 100);
      this.guest.set(next);
      storeSlugs(key, next);
      return;
    }

    this.requestBusy.set(true);
    try {
      if (this.account()?.id !== id) {
        await this.sync(id, this.guest(), () => this.auth.user()?.id === id);
        if (this.account()?.id !== id) throw new Error('Could not load the wishlist.');
      }
      const list = this.slugs();
      const saved = list.includes(slug);
      if (saved) {
        await firstValueFrom(this.http.delete(url + '/' + encodeURIComponent(slug)));
      } else {
        await this.save(slug);
      }
      if (this.auth.user()?.id === id) this.account.set({
        id,
        slugs: saved ? list.filter((item) => item !== slug) : [slug, ...list],
      });
    } finally {
      this.requestBusy.set(false);
    }
  }

  private save(slug: string) {
    return firstValueFrom(this.http.put(url + '/' + encodeURIComponent(slug), {}));
  }

  private async sync(id: string, guest: string[], active: () => boolean) {
    try {
      const saved = await firstValueFrom(this.http.get<string[]>(url));
      if (!active()) return;
      const remaining = [...guest];
      for (const slug of guest) {
        if (!active()) return;
        try {
          if (!saved.includes(slug)) {
            await this.save(slug);
            saved.push(slug);
          }
          remaining.splice(remaining.indexOf(slug), 1);
        } catch {
          // Keep unsynced items in the guest list for a future sign-in.
        }
      }
      if (active()) {
        if (guest.length) {
          this.guest.set(remaining);
          storeSlugs(key, remaining);
        }
        this.loadError.set(false);
        this.account.set({ id, slugs: saved });
      }
    } catch {
      if (active()) this.loadError.set(true);
    } finally {
      if (active()) this.syncing.set(false);
    }
  }
}
