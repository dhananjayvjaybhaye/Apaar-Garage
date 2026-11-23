import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollOnStoreNavigation } from './store-route-scroll';

describe('store navigation scrolling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets only new page navigation, leaving filters, links to sections, and Back alone', () => {
    const events = new Subject<NavigationEnd>();
    let trigger = 'imperative';
    const router = { events, lastSuccessfulNavigation: () => ({ trigger }) };
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(500);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    TestBed.runInInjectionContext(scrollOnStoreNavigation);
    const go = (path: string) => events.next(new NavigationEnd(1, path, path));

    go('/catalog');
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
    go('/catalog?category=bike');
    go('/#featured');
    trigger = 'popstate';
    go('/catalog');
    expect(scroll).toHaveBeenCalledOnce();
  });
});
