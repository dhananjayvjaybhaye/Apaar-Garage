import { describe, expect, it } from 'vitest';
import { errorTarget, ProductValidation } from './product-validation';

describe('Product form validation', () => {
  it('shows issues once fields are blurred, and excludes publication-only rules for a draft', () => {
    const validation = new ProductValidation();
    const name = { field: 'name', message: 'This field is required.' };
    const mrp = { field: 'mrp', message: 'Required to publish.' };
    validation.checked.set({ draftIssues: [name], issues: [name, mrp] });
    expect(validation.visible()).toEqual([]);
    validation.blur('name');
    validation.blur('mrp');
    expect(validation.visible()).toEqual([name]);
    validation.fail([name]);
    validation.clear('name');
    validation.checked.set({ draftIssues: [], issues: [mrp] });
    expect(validation.visible()).toEqual([]);
    validation.begin(true);
    expect(validation.visible()).toEqual([mrp]);
  });

  it('groups BIS and points each group to a missing field', () => {
    const validation = new ProductValidation();
    validation.begin(true);
    validation.fail([
      { field: 'bisCertified', message: 'BIS certification is required for toys graded under 14.' },
      { field: 'bisLicenceNumber', message: 'Provide the BIS licence number.' },
      {
        field: 'manufacturerOrImporter',
        message: 'Provide a manufacturer or importer name and address.',
      },
    ]);
    expect(validation.visible().map(({ field }) => field)).toEqual([
      'bis',
      'manufacturerOrImporter',
    ]);
    expect(errorTarget('bis', { bisCertified: 'true' })).toBe('product-bisLicenceNumber');
    expect(errorTarget('manufacturerOrImporter', { importerName: 'Sample importer' })).toBe(
      'product-importerAddress',
    );
  });
});
