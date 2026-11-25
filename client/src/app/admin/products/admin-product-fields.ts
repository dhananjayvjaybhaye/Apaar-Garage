import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { categoriesFor, type Field, type Group } from './admin-products.config';
import { FormField, FieldControl } from '../../ui/form-field/form-field';
import { focusFieldLink } from '../../ui/form-field/focus-field-link';
import { errorTarget, fieldId, validationGroup } from './product-validation';
import { issueFor } from './admin-product-feedback';
import type { AdminProductIssue, DraftFields } from './admin-product-types';

@Component({
  selector: 'app-admin-product-fields',
  imports: [FormField, FieldControl],
  templateUrl: './admin-product-fields.html',
  styleUrl: './admin-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductFields {
  readonly group = input.required<Group>();
  readonly draft = input.required<DraftFields>();
  readonly editing = input(false);
  readonly prefilled = input<ReadonlySet<string>>(new Set());
  readonly issues = input<AdminProductIssue[]>([]);
  readonly blurred = output<string>();
  protected readonly issueFor = issueFor;
  protected readonly fieldId = fieldId;
  protected readonly errorTarget = errorTarget;
  protected readonly focusLink = focusFieldLink;
  protected readonly groupIssues = computed(() =>
    this.issues().filter(({ field }) =>
      this.group().fields.some(({ key }) => validationGroup(field)?.keys.includes(key)),
    ),
  );
  protected readonly individualIssues = computed(() =>
    this.issues().filter(({ field }) => !validationGroup(field)),
  );

  protected groupErrorId(key: string) {
    const group = this.groupIssues().find(({ field }) =>
      validationGroup(field)?.keys.includes(key),
    );
    return group ? 'product-group-' + group.field : undefined;
  }
  readonly changed = output<{ key: string; value: string }>();
  protected readonly categories = computed(() => categoriesFor(this.draft()['productType']));
  protected readonly boolOptions = [
    { value: '', label: 'Unspecified' },
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ];

  protected required(field: Field) {
    return field.required === true || field.required === this.draft()['productType'];
  }

  protected choose(key: string, value: string) {
    this.changed.emit({ key, value });
  }
}
