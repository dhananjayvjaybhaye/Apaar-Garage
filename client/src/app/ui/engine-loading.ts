import { HttpEventType, type HttpInterceptorFn } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { defer, finalize, tap } from 'rxjs';

export interface EngineStatus {
  progress: number | null;
  ready: boolean;
}

const showAfter = 300;
const minimumVisible = 600;

@Injectable({ providedIn: 'root' })
export class EngineLoading {
  private readonly current = signal<EngineStatus | null>(null);
  readonly state = this.current.asReadonly();
  private readonly work = new Map<symbol, number | null>();
  private completed = 0;
  private shownAt = 0;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const routes = new Map<number, () => void>();
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) routes.set(event.id, this.begin().finish);
      if (event instanceof NavigationEnd || event instanceof NavigationCancel ||
          event instanceof NavigationError || event instanceof NavigationSkipped) {
        routes.get(event.id)?.();
        routes.delete(event.id);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      clearTimeout(this.showTimer);
      clearTimeout(this.hideTimer);
    });
  }

  begin() {
    const task = Symbol();
    if (!this.work.size) {
      this.completed = 0;
      clearTimeout(this.hideTimer);
      if (!this.shownAt) {
        this.showTimer = setTimeout(() => {
          this.shownAt = Date.now();
          this.publish();
        }, showAfter);
      }
    }
    this.work.set(task, null);
    this.publish();

    return {
      progress: (fraction: number) => {
        if (!this.work.has(task) || !Number.isFinite(fraction)) return;
        this.work.set(task, Math.min(0.99, Math.max(this.work.get(task) ?? 0, fraction)));
        this.publish();
      },
      finish: () => {
        if (!this.work.delete(task)) return;
        this.completed++;
        if (this.work.size) {
          this.publish();
          return;
        }
        clearTimeout(this.showTimer);
        if (!this.shownAt) return;
        this.current.set({ progress: 1, ready: true });
        this.hideTimer = setTimeout(() => {
          this.shownAt = 0;
          this.current.set(null);
        }, Math.max(150, minimumVisible - (Date.now() - this.shownAt)));
      },
    };
  }

  private publish() {
    if (!this.shownAt) return;
    const fractions = [...this.work.values()];
    const known = fractions.some((value) => value !== null) || this.completed > 0;
    const total = fractions.reduce<number>((sum, value) => sum + (value ?? 0), this.completed);
    const measured = total / (fractions.length + this.completed);
    const prior = this.current();
    const progress = known ? Math.max(prior?.ready ? 0 : (prior?.progress ?? 0), measured) : null;
    this.current.set({ progress, ready: false });
  }
}

export const engineRequests: HttpInterceptorFn = (request, next) => {
  if (!/^\/(?:api(?:\/|$)|products(?:\/|\?|$))/.test(request.url)) return next(request);
  const loading = inject(EngineLoading);
  return defer(() => {
    const job = loading.begin();
    return next(request.clone({ reportProgress: true })).pipe(
      tap((event) => {
        if (event.type === HttpEventType.DownloadProgress && event.total) job.progress(event.loaded / event.total);
      }),
      finalize(job.finish),
    );
  });
};
