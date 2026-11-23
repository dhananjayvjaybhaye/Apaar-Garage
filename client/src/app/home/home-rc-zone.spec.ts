import { firstValueFrom, of, throwError } from 'rxjs';
import type { CatalogQuery } from '../catalog/catalog-api';
import type { ProductPage, RcProduct } from '../catalog/product';
import { loadRcZone } from './home-rc-zone';

function item(slug: string, featured = false): RcProduct {
  return {
    slug,
    featured,
    name: slug,
    brand: 'Scale Lab',
    price: 25,
    stock: 1,
    images: [],
    description: '',
    productType: 'rc',
    category: 'rc-car',
    batteryIncluded: true,
    skillLevel: 'beginner',
    recommendedAge: 8,
    readyToRun: true,
    warrantyDays: 0,
    boxContents: [],
  };
}

const page = (items: ProductPage['items']): ProductPage => ({
  items,
  page: 1,
  limit: 8,
  total: items.length,
  totalPages: items.length ? 1 : 0,
});

describe('RC hero listing', () => {
  it('uses a marked product and skips the newest lookup', async () => {
    const featured = item('featured', true);
    const api = { getProducts: vi.fn(() => of(page([item('other'), featured]))) };
    expect((await firstValueFrom(loadRcZone(api, 8))).bench).toBe(featured);
    expect(api.getProducts).toHaveBeenCalledTimes(1);
  });

  it('looks for the newest product across the full RC catalog and preserves the section order', async () => {
    const original = item('alphabetical');
    const newest = item('newest');
    const api = {
      getProducts: vi.fn((query: CatalogQuery) =>
        of(page(query.sort === 'newest' ? [newest] : [original])),
      ),
    };
    expect(await firstValueFrom(loadRcZone(api, 8))).toEqual({ items: [original], bench: newest });
    expect(api.getProducts).toHaveBeenLastCalledWith({
      productType: 'rc',
      sort: 'newest',
      limit: 1,
    });
  });

  it('only leaves the bench empty when the RC listings are empty', async () => {
    const empty = { getProducts: vi.fn(() => of(page([]))) };
    expect((await firstValueFrom(loadRcZone(empty, 8))).bench).toBeUndefined();
    expect(empty.getProducts).toHaveBeenCalledTimes(1);
    const existing = item('existing');
    const api = {
      getProducts: vi.fn((query: CatalogQuery) =>
        query.sort === 'newest'
          ? throwError(() => Error('Newest listing unavailable'))
          : of(page([existing])),
      ),
    };
    expect((await firstValueFrom(loadRcZone(api, 8))).bench).toBe(existing);
  });
});
