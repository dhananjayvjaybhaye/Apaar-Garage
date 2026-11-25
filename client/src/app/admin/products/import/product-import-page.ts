import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FieldControl, FormField } from '../../../ui/form-field/form-field';
import {
  ProductImportApi,
  saveDownload,
  type ImportMode,
  type SheetFormat,
  type ImportResult,
} from './product-import-api';
import { productRequestMessage } from '../admin-product-feedback';

@Component({
  selector: 'app-product-import-page',
  imports: [RouterLink, FormField, FieldControl],
  templateUrl: './product-import-page.html',
  styleUrl: './product-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImportPage {
  private readonly api = inject(ProductImportApi);
  protected readonly sheet = signal<File | undefined>(undefined);
  protected readonly images = signal<File | undefined>(undefined);
  protected readonly mode = signal<ImportMode>('create');
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly busy = signal('');
  protected readonly error = signal('');

  protected file(kind: 'sheet' | 'images', input: HTMLInputElement) {
    (kind === 'sheet' ? this.sheet : this.images).set(input.files?.[0]);
    this.reset();
  }

  protected selectMode(input: string) {
    if (input === 'create' || input === 'upsert') this.mode.set(input);
    this.reset();
  }

  private reset() {
    this.result.set(null);
    this.error.set('');
  }

  protected download(kind: 'template' | 'export', format: string, includeCost: boolean) {
    if (format !== 'csv' && format !== 'xlsx') return;
    return this.run('Preparing download…', () => this.api.download(kind, format, includeCost));
  }

  protected preview(event: Event) {
    event.preventDefault();
    this.reset();
    return this.send();
  }

  protected confirm() {
    const proof = this.result()?.proof;
    if (proof) return this.send(proof);
    return;
  }

  private send(proof?: string) {
    const file = this.sheet();
    if (!file) {
      this.error.set('Choose a CSV or XLSX file.');
      return;
    }
    return this.run(proof ? 'Importing drafts…' : 'Checking rows…', async () => {
      this.result.set(await this.api.send(file, this.images(), this.mode(), proof));
    });
  }

  protected failedRows(csv: string) {
    saveDownload(new Blob([csv], { type: 'text/csv; charset=utf-8' }), 'failed-product-rows.csv');
  }

  private async run(label: string, action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(label);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(
        productRequestMessage(error, 'The operation could not be completed. Try again.'),
      );
    } finally {
      this.busy.set('');
    }
  }
}
