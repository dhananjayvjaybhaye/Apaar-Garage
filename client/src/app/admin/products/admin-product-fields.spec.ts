import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminProductFields } from './admin-product-fields';
import { generalFields } from './admin-products.config';
import { draftFields, productPayload } from './admin-product-types';

describe('admin product editor fields', () => {
  it('selects the saved product type, category and status', () => {
    const fixture = TestBed.createComponent(AdminProductFields);
    fixture.componentRef.setInput('group', generalFields[0]);
    fixture.componentRef.setInput('draft', {
      productType: 'rc',
      category: 'rc-plane',
      status: 'hidden',
    });
    fixture.detectChanges();
    const controls = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('select'),
    ];
    expect(controls.slice(0, 3).map(({ value }) => value)).toEqual(['rc', 'rc-plane', 'hidden']);
  });

  it('preserves zero values and image order while clearing optional fields on edit', () => {
    const draft = { ...draftFields(), price: '0', costPrice: '0', 'dimensionsMm.width': '45' };
    const payload = productPayload(
      draft,
      [
        { url: '/b.webp', alt: 'Side view' },
        { url: '/a.webp', alt: 'Front view' },
      ],
      '',
      true,
    );
    expect(payload).toMatchObject({
      price: 0,
      costPrice: 0,
      dimensionsMm: { width: 45 },
      glbUrl: null,
      images: ['/b.webp', '/a.webp'],
      imageAlts: ['Side view', 'Front view'],
    });
    expect(payload).not.toHaveProperty('stock');
    expect(payload).not.toHaveProperty('slug');
  });
});
