import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export function scrollOnStoreNavigation() {
  const view = inject(DOCUMENT).defaultView;
  if (!view) return;
  const router = inject(Router);
  const destroy = inject(DestroyRef);
  let previousPath = view.location.pathname;
  router.events
    .pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(destroy),
    )
    .subscribe((event) => {
      const next = new URL(event.urlAfterRedirects, view.location.origin);
      // Filters, fragments, and Back keep their own scroll position.
      if (
        view.scrollY > 0 &&
        next.pathname !== previousPath &&
        !next.hash &&
        router.lastSuccessfulNavigation()?.trigger === 'imperative'
      )
        view.scrollTo({ top: 0, behavior: 'instant' });
      previousPath = next.pathname;
    });
}
