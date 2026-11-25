import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { ProductImportApi, type ProductPrefill, type Suggestion } from './product-import-api';
import { FieldControl, FormField } from '../../../ui/form-field/form-field';
import { productLabel } from '../admin-product-types';
import { productRequestMessage } from '../admin-product-feedback';

@Component({
  selector: 'app-product-prefill',
  imports: [FormField, FieldControl],
  templateUrl: './product-prefill.html',
  styleUrl: './product-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPrefillComponent {
  private readonly api = inject(ProductImportApi);
  readonly filled = output<Record<string, unknown>>();
  protected readonly open = signal(false);
  protected readonly extraction = signal(false);
  protected readonly result = signal<ProductPrefill | null>(null);
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly selected = signal(new Set<string>());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly label = productLabel;

  protected async toggle() {
    this.open.update((value) => !value);
    if (!this.open()) return;
    try {
      this.extraction.set((await this.api.capabilities()).extraction);
    } catch {
      this.extraction.set(false);
    }
  }

  protected load(input: HTMLInputElement, extract = false) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    return this.run(async () => {
      this.result.set(null);
      this.suggestions.set([]);
      if (extract) {
        const { suggestions } = await this.api.extract(file);
        this.suggestions.set(suggestions);
        this.selected.set(new Set());
        if (!suggestions.length) this.error.set('The service did not find any product fields.');
      } else this.result.set(await this.api.prefill(file));
    });
  }

  protected choose(field: string, checked: boolean) {
    this.selected.update((previous) => {
      const next = new Set(previous);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  protected reviewSuggestions() {
    const values = Object.fromEntries(
      this.suggestions()
        .filter(({ field }) => this.selected().has(field))
        .map(({ field, value }) => [field, value]),
    );
    const file = new File([JSON.stringify(values)], 'suggestions.json', {
      type: 'application/json',
    });
    return this.run(async () => {
      this.result.set(await this.api.prefill(file));
      this.suggestions.set([]);
    });
  }

  protected apply(values: Record<string, unknown>) {
    this.filled.emit(values);
    this.open.set(false);
    this.result.set(null);
  }

  protected confidence(value: number) {
    return Math.round(value * 100) + '%';
  }

  protected valueText(value: unknown) {
    return Array.isArray(value) ? value.join(', ') : String(value);
  }

  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(
        productRequestMessage(error, 'Could not read the file. Check its format and try again.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
