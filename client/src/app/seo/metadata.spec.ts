import { describe, expect, it } from 'vitest';
import { metadataTags, pageMetadata, structuredData, type SeoProduct } from './metadata.mjs';

const site = 'https://shop.example';
const model: SeoProduct = {
  slug: 'midnight-coupe',
  name: 'Midnight Coupe',
  description: 'A display coupe with a graphite finish.',
  category: 'car',
  price: 1599,
  stock: 0,
  brand: 'Display Series',
  placeholder: true,
  images: ['/images/placeholders/midnight-coupe.svg'],
};

describe('Storefront metadata', () => {
  it('uses the canonical category URL and drops temporary filters', () => {
    const info = pageMetadata('/catalog?category=rc-car&productType=rc&sort=newest', site);
    expect(info.canonical).toBe(site + '/catalog?category=rc-car');
    expect(info.graph[0]).toMatchObject({ '@type': 'BreadcrumbList' });
    expect(metadataTags(info)).toContainEqual(['property', 'og:title', 'RC Cars | Apaar Garage']);
  });

  it('uses a raster share image and the actual listing image in the product schema', () => {
    const info = pageMetadata('/product/midnight-coupe?from=home', site, model);
    expect(info.title).toBe('Midnight Coupe | Apaar Garage');
    expect(info.image).toBe(site + '/images/share-garage.jpg');
    expect(info.graph).toContainEqual(
      expect.objectContaining({
        '@type': 'Product',
        image: site + model.images[0],
        offers: expect.objectContaining({
          price: 1599,
          priceCurrency: 'INR',
          availability: 'https://schema.org/OutOfStock',
        }),
      }),
    );
    expect(pageMetadata('/product/another', site, model).indexable).toBe(false);
  });

  it('omits private identifiers from share URLs and escapes markup in structured data', () => {
    const tracking = pageMetadata('/track-order/AG-0123?from=confirmation', site);
    expect(tracking.canonical).toBe(site + '/track-order');
    expect(tracking.indexable).toBe(false);
    expect(structuredData([{ name: '</script><script>' }])).not.toContain('<');
  });
});
