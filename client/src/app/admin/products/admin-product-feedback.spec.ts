import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { issueFor, productRequestMessage } from './admin-product-feedback';

describe('Product save feedback', () => {
  it('distinguishes offline, expired, oversized and validation responses', () => {
    const message = (status: number, error?: unknown) =>
      productRequestMessage(new HttpErrorResponse({ status, error }), 'Please try again.');
    for (const status of [0, 502, 503, 504])
      expect(message(status, new TypeError('Failed to fetch'))).toBe(
        "Can't reach the server. Check that it is running and try again.",
      );
    expect(message(401)).toBe('Your session expired, sign in again.');
    expect(message(413)).toContain('listing is too large');
    expect(message(400, { message: 'Review the product fields.' })).toBe('Review the product fields.');
    expect(message(500, { message: 'Failed to fetch' })).toBe('Please try again.');
  });

  it('associates nested and either-or issues with their controls', () => {
    const issues = [
      { field: 'dimensionsMm.height', message: 'Enter a positive height.' },
      { field: 'manufacturerOrImporter', message: 'Enter a name and address.' },
    ];
    expect(issueFor(issues, 'dimensionsMm.height')).toBe('Enter a positive height.');
    expect(issueFor(issues, 'dimensionsMm.width')).toBeUndefined();
    expect(issueFor(issues, 'importerName')).toBe('Enter a name and address.');
  });
});
