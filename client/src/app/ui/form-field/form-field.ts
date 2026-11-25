import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'app-form-field',
  exportAs: 'formField',
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string>();
  readonly error = input<string>();
  readonly groupErrorId = input<string>();
  readonly unit = input<string>();
  readonly invalid = computed(() => (this.error() || this.groupErrorId() ? 'true' : null));
  readonly describedBy = computed(
    () =>
      [
        this.unit() && this.controlId() + '-unit',
        this.hint() && this.controlId() + '-hint',
        this.error() && this.controlId() + '-error',
        this.groupErrorId(),
      ]
        .filter(Boolean)
        .join(' ') || null,
  );
}

@Directive({
  selector: '[appFieldControl]',
  host: {
    class: 'shared-field-control',
    '[id]': 'field().controlId()',
    '[attr.aria-invalid]': 'field().invalid()',
    '[attr.aria-describedby]': 'field().describedBy()',
  },
})
export class FieldControl {
  readonly field = input.required<FormField>({ alias: 'appFieldControl' });
}
