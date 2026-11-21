import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Motion } from '../../motion/motion';
import { GarageSound } from '../../ui/garage-sound';
import { GarageIntro } from './garage-intro';
import { garageIntro } from './garage-intro-motion';

const dialogApi = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(dialogApi, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(dialogApi, 'close');

describe('Garage intro', () => {
  afterEach(() => {
    vi.useRealTimers();
    if (originalShowModal) Object.defineProperty(dialogApi, 'showModal', originalShowModal);
    else Reflect.deleteProperty(dialogApi, 'showModal');
    if (originalClose) Object.defineProperty(dialogApi, 'close', originalClose);
    else Reflect.deleteProperty(dialogApi, 'close');
    sessionStorage.removeItem('apaar-garage-entered');
    document.documentElement.classList.remove('garage-intro-open');
  });

  it('releases the modal and scroll lock after eight seconds without a click', () => {
    vi.useFakeTimers();
    // jsdom lacks the native modal top layer used by Chrome.
    Object.defineProperties(dialogApi, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    sessionStorage.removeItem('apaar-garage-entered');
    TestBed.configureTestingModule({
      imports: [GarageIntro],
      providers: [
        { provide: Motion, useValue: { level: signal('full') } },
        { provide: GarageSound, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(GarageIntro);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    vi.advanceTimersToNextFrame();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('dialog')?.open).toBe(true);
    expect(document.documentElement.classList.contains('garage-intro-open')).toBe(true);
    expect(root.querySelectorAll('button')).toHaveLength(1);

    vi.advanceTimersByTime(garageIntro.failsafeMs);
    fixture.detectChanges();
    expect(root.querySelector('dialog')).toBeNull();
    expect(document.documentElement.classList.contains('garage-intro-open')).toBe(false);
    expect(sessionStorage.getItem('apaar-garage-entered')).toBe('true');
    expect(closed).toHaveBeenCalledOnce();
  });
});
