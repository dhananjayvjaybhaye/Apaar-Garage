import { HttpErrorResponse } from '@angular/common/http';
import type { AdminProductIssue } from './admin-product-types';

const networkMessage = "Can't reach the server. Check that it is running and try again.";
export const expiredProductSession = 'Your session expired, sign in again.';

export function productRequestMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if ([0, 502, 503, 504].includes(error.status)) return networkMessage;
  if (error.status === 401) return expiredProductSession;
  if (error.status === 413)
    return 'The listing is too large. Shorten the text or remove unused media URLs and try again.';
  const message = error.error?.message;
  return typeof message === 'string' && !/failed to fetch/i.test(message) ? message : fallback;
}

export function issueFor(issues: AdminProductIssue[], key: string) {
  return issues.find(
    ({ field }) =>
      field === key ||
      field.startsWith(key + '.') ||
      key.startsWith(field + '.') ||
      (field === 'manufacturerOrImporter' && /^(manufacturer|importer)(Name|Address)$/.test(key)),
  )?.message;
}
