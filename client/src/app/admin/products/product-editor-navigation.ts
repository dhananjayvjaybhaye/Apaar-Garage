import { afterNextRender, ElementRef, inject, Injector, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSessionStore } from '../admin-session-store';
import { adminProductPath } from './admin-products.config';

export class ProductEditorNavigation {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly api = inject(AdminSessionStore);

  constructor(
    private readonly dirty: Signal<boolean>,
    private readonly discard: () => void,
  ) {}

  canLeave(nextUrl: string) {
    if (!this.api.session() || !this.dirty() || nextUrl.startsWith('/admin/login')) return true;
    return (
      this.host.ownerDocument.defaultView?.confirm('Leave with unsaved product changes?') ?? true
    );
  }

  beforeUnload(event: BeforeUnloadEvent) {
    if (!this.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async cancel() {
    if (await this.router.navigateByUrl(adminProductPath)) this.discard();
  }

  focusFeedback(selector: string) {
    afterNextRender(
      () => {
        const target = this.host.querySelector<HTMLElement>(selector);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: 'center' });
      },
      { injector: this.injector },
    );
  }
}
