import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionLevel, motionQueries } from './motion-policy';

interface Pointer { x: number; y: number; target: Element | null }
interface MotionFrame {
  pointer: Pointer | null;
  width: number;
  height: number;
}
type FrameListener = (frame: MotionFrame) => void;
type ScrollPlugin = typeof ScrollTrigger;

@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;
  readonly zone = inject(NgZone);
  private readonly policy = signal(motionLevel(this.view));
  readonly level = this.policy.asReadonly();

  private readonly listeners = new Set<FrameListener>();
  private readonly jobs = new Map<object, () => void>();
  private pointer: Pointer | null = null;
  private hitTestPending = false;
  private frameId = 0;
  private scrollPlugin?: Promise<{ gsap: typeof import('gsap').gsap; ScrollTrigger: ScrollPlugin } | null>;

  constructor() {
    const view = this.view;
    if (!view?.matchMedia) return;
    const lifetime = inject(DestroyRef);
    const routes = inject(Router, { optional: true })?.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.reset();
    });
    const events = new AbortController();
    const signal = events.signal;
    this.zone.runOutsideAngular(() => {
      for (const query of motionQueries) {
        const media = view.matchMedia(query);
        media.addEventListener('change', this.refreshPolicy, { signal });
      }
      this.refreshPolicy();
      this.document.addEventListener('pointermove', this.move, { signal, passive: true });
      this.document.addEventListener('pointerout', this.leave, { signal, passive: true });
      this.document.addEventListener('visibilitychange', this.visibility, { signal });
      view.addEventListener('blur', this.reset, { signal });
      view.addEventListener('resize', this.viewport, { signal, passive: true });
      view.addEventListener('scroll', this.viewport, { signal, passive: true });
    });
    lifetime.onDestroy(() => {
      routes?.unsubscribe();
      events.abort();
      if (this.frameId) view.cancelAnimationFrame(this.frameId);
      this.document.documentElement.removeAttribute('data-motion');
    });
  }

  subscribe(listener: FrameListener) {
    this.listeners.add(listener);
    this.requestFrame();
    return () => { this.listeners.delete(listener); };
  }

  schedule(key: object, job: () => void) {
    this.jobs.set(key, job);
    this.requestFrame();
  }

  cancel(key: object) {
    this.jobs.delete(key);
  }

  revealWhenVisible(element: HTMLElement, reveal: () => void) {
    let done = false;
    let observer: IntersectionObserver | undefined;
    let trigger: ScrollTrigger | undefined;
    const stop = () => {
      done = true;
      observer?.disconnect();
      trigger?.kill();
    };
    const enter = () => {
      if (done) return;
      stop();
      reveal();
    };
    if (typeof IntersectionObserver === 'undefined') return stop;

    // Keep a lightweight fallback for motion preferences and unavailable plugin chunks.
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) enter();
    });
    observer.observe(element);

    if (this.level() === 'full') {
      void this.loadScrollTools().then((tools) => {
        if (!tools || done || !element.isConnected || this.level() !== 'full') return;
        trigger = tools.ScrollTrigger.create({ trigger: element, start: 'top 98%', once: true, onEnter: enter });
        if (done) trigger.kill();
      });
    }
    return stop;
  }

  loadScrollTools() {
    return this.scrollPlugin ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);
        return { gsap, ScrollTrigger };
      }).catch(() => null);
  }

  private refreshPolicy = () => {
    const level = motionLevel(this.view);
    this.policy.set(level);
    this.document.documentElement.dataset['motion'] = level;
    if (level !== 'full') this.pointer = null;
    this.requestFrame();
  };

  private move = (event: PointerEvent) => {
    if (this.level() !== 'full') return;
    if (event.pointerType !== 'mouse') {
      this.reset();
      return;
    }
    this.pointer = {
      x: event.clientX, y: event.clientY,
      target: event.target instanceof Element ? event.target : null,
    };
    this.requestFrame();
  };

  private leave = (event: PointerEvent) => {
    if (event.relatedTarget === null) this.reset();
  };

  private visibility = () => {
    if (this.document.hidden) {
      this.pointer = null;
      this.jobs.clear();
      if (this.frameId) this.view?.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    } else this.requestFrame();
  };

  private reset = () => {
    if (!this.pointer) return;
    this.pointer = null;
    this.requestFrame();
  };

  private viewport = () => {
    if (this.level() !== 'full') return;
    this.hitTestPending = true;
    this.requestFrame();
  };

  private requestFrame() {
    const view = this.view;
    if (!view?.requestAnimationFrame || this.frameId || this.document.hidden) return;
    this.zone.runOutsideAngular(() => {
      this.frameId = view.requestAnimationFrame(() => {
        this.frameId = 0;
        const jobs = [...this.jobs.values()];
        this.jobs.clear();
        if (this.hitTestPending && this.pointer) {
          this.pointer.target = this.document.elementFromPoint(this.pointer.x, this.pointer.y);
        }
        this.hitTestPending = false;
        const frame = { pointer: this.pointer, width: view.innerWidth, height: view.innerHeight };
        for (const listener of this.listeners) listener(frame);
        for (const job of jobs) job();
      });
    });
  }
}
