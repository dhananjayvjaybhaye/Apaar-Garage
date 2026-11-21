import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    localStorage.removeItem('apaar-recently-viewed');
    localStorage.removeItem('apaar-stock-watch');
    localStorage.removeItem('apaar-has-guest-cart');
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
  });

  it('renders the catalog and requests the selected category', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/auth/me?optional=true').flush(null);
    await TestBed.inject(Router).navigateByUrl('/catalog');
    await fixture.whenStable();

    http
      .expectOne('/products?page=1&limit=8&facets=true')
      .flush({ items: [], page: 1, limit: 8, total: 0, totalPages: 0 });
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('The collection');
    const bikes = [...page.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Bikes',
    );
    expect(bikes).toBeDefined();
    bikes?.click();
    await fixture.whenStable();

    http
      .expectOne('/products?category=bike&page=1&limit=8&facets=true')
      .flush({ items: [], page: 1, limit: 8, total: 0, totalPages: 0 });
    http.verify();
    expect(bikes?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens a product by slug and shows photos when there is no model', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/auth/me?optional=true').flush(null);
    await TestBed.inject(Router).navigateByUrl('/product/bmw-r-1250-gs');
    const product = await vi.waitFor(() => http.expectOne('/products/bmw-r-1250-gs'));
    product.flush({
      name: 'BMW R 1250 GS',
      slug: 'bmw-r-1250-gs',
      category: 'bike',
      brand: 'Welly',
      scale: '1:18',
      price: 1499,
      stock: 0,
      images: ['/images/bike.jpg', '/images/bike-side.jpg'],
      description: 'Adventure touring model.',
      featured: false,
    });
    await vi.waitFor(() => {
      http.expectOne('/products?category=bike&sort=popular&limit=5').flush({ items: [] });
    });
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('BMW R 1250 GS');
    expect(page.querySelector('app-stock-alert button')?.textContent?.trim()).toBe('Notify me when back in stock');
    expect(page.querySelector('app-car-viewer')).toBeNull();
    page.querySelector<HTMLButtonElement>('button[aria-label="Show photo 2"]')?.click();
    await fixture.whenStable();
    expect(page.querySelector('.gallery-image img')?.getAttribute('src')).toBe(
      '/images/bike-side.jpg',
    );
    http.verify();
  });
});
