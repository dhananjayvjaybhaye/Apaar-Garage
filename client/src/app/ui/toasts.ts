import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';

type Toast = { id: number; message: string; error: boolean };

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;

  show(message: string, error = false) {
    const id = ++this.nextId;
    if (this.items().length === 3) this.dismiss(this.items()[0].id);
    this.items.update((items) => [...items, { id, message, error }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), error ? 9000 : 5000));
  }

  dismiss(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.items.update((items) => items.filter((item) => item.id !== id));
  }
}

@Component({
  selector: 'app-toasts',
  template: `
    <div class="stack">
      <div role="status" aria-live="polite" aria-relevant="additions">
        @for (item of store.items(); track item.id) {
          @if (!item.error) {
            <div class="toast"><span aria-hidden="true">✓</span><span>{{ item.message }}</span></div>
          }
        }
      </div>
      <div role="alert" aria-live="assertive" aria-relevant="additions">
        @for (item of store.items(); track item.id) {
          @if (item.error) {
            <div class="toast error"><span aria-hidden="true">!</span><span>{{ item.message }}</span></div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .stack { position:fixed; z-index:25; pointer-events:none; inset:auto 1rem calc(var(--mobile-clearance) + 3.8rem) auto; width:min(24rem, calc(100% - 2rem)); }
    .toast { display:flex; gap:.65rem; align-items:flex-start; margin-top:.45rem; border:1px solid var(--line); border-inline-start:4px solid var(--success); background:var(--panel); color:var(--text); border-radius:var(--radius); padding:.7rem .9rem; box-shadow:var(--shadow); }
    .toast.error { border-inline-start-color:var(--error); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHost {
  protected readonly store = inject(Toasts);
}
