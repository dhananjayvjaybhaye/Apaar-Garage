import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { expect, vi } from 'vitest';
import { AdminSessionStore } from './admin-session-store';

export async function mountAdmin<T>(
  component: Type<T>,
  options: {
    params?: Record<string, string>;
    query?: Record<string, string>;
    permissions?: string[];
    hasStaff?: boolean;
  } = {},
) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const route = TestBed.inject(ActivatedRoute);
  Object.defineProperty(route, 'paramMap', { configurable: true, value: of(convertToParamMap(options.params ?? {})) });
  Object.defineProperty(route, 'queryParamMap', { configurable: true, value: of(convertToParamMap(options.query ?? {})) });
  const http = TestBed.inject(HttpTestingController);
  const restored = TestBed.inject(AdminSessionStore).restore();
  http.expectOne('/api/auth/admin/session').flush({
    name: 'Admin',
    email: 'admin@example.test',
    csrfToken: 'test-csrf',
    expiresAt: '2099-01-01T00:00:00.000Z',
    idleUntil: '2099-01-01T00:00:00.000Z',
    serverTime: new Date().toISOString(),
    setupRequired: false,
    twoFactorEnabled: true,
    permissions: options.permissions,
    hasStaff: options.hasStaff,
  });
  await restored;
  const fixture = TestBed.createComponent(component);
  const root = fixture.nativeElement as HTMLElement;
  fixture.detectChanges();

  function find<TElement extends HTMLElement = HTMLElement>(selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    expect(element, selector).toBeTruthy();
    return element!;
  }

  function button(text: string): HTMLButtonElement {
    const match = [...root.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);
    expect(match, text).toBeTruthy();
    return match!;
  }

  function interactive(control: HTMLElement) {
    control.focus();
    expect(document.activeElement).toBe(control);
    expect(control.tabIndex).toBeGreaterThanOrEqual(0);
  }

  function field(selector: string, value: string, event = 'input') {
    const control = find<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
    control.value = value;
    control.dispatchEvent(new Event(event, { bubbles: true }));
    fixture.detectChanges();
    return control;
  }

  async function verify(check: () => void) {
    await vi.waitFor(() => { fixture.detectChanges(); check(); });
  }

  const text = (value: string) => verify(() => expect(root.textContent).toContain(value));
  return { fixture, root, http, find, button, interactive, field, verify, text };
}

export const emptyPage = { items: [], page: 1, total: 0, totalPages: 0 };
export const onePage = <T>(item: T) => ({ items: [item], page: 1, total: 1, totalPages: 1 });
export const serverError = { status: 500, statusText: 'Server error' };
