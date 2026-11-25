import { inject, Injectable } from '@angular/core';
import { AdminSessionStore } from '../../admin-session-store';
import type { AdminProductIssue } from '../admin-product-types';

export type SheetFormat = 'csv' | 'xlsx';
export type ImportMode = 'create' | 'upsert';
type RowStatus = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRow {
  number: number;
  sku?: string;
  name?: string;
  status: RowStatus;
  errors: AdminProductIssue[];
}
export interface ImportResult {
  rows: ImportRow[];
  counts: Record<RowStatus, number>;
  proof?: string;
  failedCsv?: string;
}
export interface ImportHistory {
  id: string;
  file: string;
  actor: string;
  mode: ImportMode;
  at: string;
  counts: ImportResult['counts'];
}
export interface ProductPrefill {
  values: Record<string, unknown>;
  issues: AdminProductIssue[];
  publishing: AdminProductIssue[];
}
export interface Suggestion {
  field: string;
  value: unknown;
  confidence: number;
}

const base = '/api/admin/product-imports';
export const productImportPath = '/admin/product-import';

@Injectable({ providedIn: 'root' })
export class ProductImportApi {
  private readonly session = inject(AdminSessionStore);

  send(sheet: File, images: File | undefined, mode: ImportMode, proof?: string) {
    const form = new FormData();
    form.set('sheet', sheet);
    if (images) form.set('images', images);
    form.set('mode', mode);
    if (proof) form.set('proof', proof);
    return this.session.saveProduct<ImportResult>(
      'POST',
      base + (proof ? '/apply' : '/preview'),
      form,
    );
  }

  prefill(file: File) {
    return this.upload<ProductPrefill>('prefill', file);
  }

  extract(file: File) {
    return this.upload<{ suggestions: Suggestion[] }>('extract', file);
  }

  private upload<T>(action: string, file: File) {
    const form = new FormData();
    form.set('sheet', file);
    return this.session.saveProduct<T>('POST', base + '/' + action, form);
  }

  capabilities() {
    return this.session.request<{ extraction: boolean }>('GET', base + '/capabilities');
  }

  history() {
    return this.session.request<ImportHistory[]>('GET', base + '/history');
  }

  async download(kind: 'template' | 'export', format: SheetFormat, includeCost: boolean) {
    const blob = await this.session.download(
      base +
        '/' +
        kind +
        '?format=' +
        format +
        (includeCost && kind === 'export' ? '&includeCost=true' : ''),
    );
    saveDownload(blob, (kind === 'template' ? 'product-template' : 'products') + '.' + format);
  }
}

export function saveDownload(blob: Blob, name: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  // Allow the browser to hand off the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
