import { catchError, map, of, switchMap } from 'rxjs';
import type { CatalogApi } from '../catalog/catalog-api';

export function loadRcZone(api: Pick<CatalogApi, 'getProducts'>, limit: number) {
  return api.getProducts({ productType: 'rc', sort: 'featured', limit }).pipe(
    switchMap(({ items }) => {
      const featured = items.find((item) => item.featured);
      if (featured || !items.length) return of({ items, bench: featured });

      // Search the full RC catalog for the newest listing. Keep the section's existing sort.
      return api.getProducts({ productType: 'rc', sort: 'newest', limit: 1 }).pipe(
        map(({ items: newest }) => ({ items, bench: newest[0] ?? items[0] })),
        catchError(() => of({ items, bench: items[0] })),
      );
    }),
  );
}
