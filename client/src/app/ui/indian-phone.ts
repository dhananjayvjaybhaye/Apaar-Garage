import type { AbstractControl, ValidationErrors } from '@angular/forms';

export function indianPhoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const raw = control.value;
  const normalized = raw
    .trim()
    .replace(/[\s()-]/g, '')
    .replace(/^(?:\+?91|0)(?=\d{10}$)/, '');
  return !raw || (raw.length <= 32 && /^[6-9]\d{9}$/.test(normalized)) ? null : { pattern: true };
}
