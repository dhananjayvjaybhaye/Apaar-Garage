import { HttpEventType, HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineLoading, engineRequests } from './engine-loading';

describe('EngineLoading', () => {
  let routes: Subject<unknown>;
  let loading: EngineLoading;

  beforeEach(() => {
    vi.useFakeTimers();
    routes = new Subject();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events: routes } }] });
    loading = TestBed.inject(EngineLoading);
  });

  afterEach(() => vi.useRealTimers());

  it('keeps work completing within 300 ms off screen', () => {
    const job = loading.begin();
    vi.advanceTimersByTime(299);
    job.finish();
    vi.advanceTimersByTime(700);
    expect(loading.state()).toBeNull();
  });

  it('shows measured progress and keeps a visible gauge for at least 600 ms', () => {
    const job = loading.begin();
    job.progress(0.4);
    vi.advanceTimersByTime(300);
    expect(loading.state()).toEqual({ progress: 0.4, ready: false });
    vi.advanceTimersByTime(100);
    job.finish();
    expect(loading.state()).toEqual({ progress: 1, ready: true });
    vi.advanceTimersByTime(499);
    expect(loading.state()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(loading.state()).toBeNull();
  });

  it('ends cancelled navigation and continues tracking overlapping requests', () => {
    routes.next(new NavigationStart(1, '/catalog'));
    const job = loading.begin();
    vi.advanceTimersByTime(300);
    expect(loading.state()).toEqual({ progress: null, ready: false });
    routes.next(new NavigationCancel(1, '/catalog', 'Superseded'));
    expect(loading.state()?.ready).toBe(false);
    job.finish();
    expect(loading.state()?.ready).toBe(true);
  });

  it('uses reported download bytes and passes the response through immediately', () => {
    const events = new Subject<HttpEvent<unknown>>();
    const response = new HttpResponse({ body: { items: [] } });
    const delivered = vi.fn();
    TestBed.runInInjectionContext(() => engineRequests(new HttpRequest('GET', '/products'), (request) => {
      expect(request.reportProgress).toBe(true);
      return events;
    }).subscribe(delivered));

    vi.advanceTimersByTime(300);
    events.next({ type: HttpEventType.DownloadProgress, loaded: 112, total: 320 });
    expect(loading.state()?.progress).toBe(0.35);
    events.next(response);
    expect(delivered).toHaveBeenLastCalledWith(response);
    events.complete();
    expect(loading.state()?.ready).toBe(true);
  });


});
