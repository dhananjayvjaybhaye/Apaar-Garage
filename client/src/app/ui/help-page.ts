import { Magnetic } from '../motion/magnetic';
import { Reveal } from '../reveal';
import { Tilt } from '../motion/tilt';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';

@Component({
  selector: 'app-help-page',
  imports: [Magnetic, Reveal, Tilt, RouterLink, ReactiveFormsModule],
  templateUrl: './help-page.html',
  styleUrl: './help-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  private readonly http = inject(HttpClient);
  private readonly builder = inject(FormBuilder).nonNullable;
  protected readonly form = this.builder.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    message: ['', [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)]],
  });
  protected readonly sending = signal(false);
  protected readonly reference = signal('');
  protected readonly error = signal('');

  protected async submit(element: HTMLFormElement) {
    if (this.sending()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) {
      element.querySelector<HTMLElement>('[aria-invalid="true"], input.ng-invalid, textarea.ng-invalid')?.focus();
      return;
    }

    this.sending.set(true);
    this.reference.set('');
    try {
      const { reference } = await firstValueFrom(this.http.post<{ reference: string }>('/api/support', this.form.getRawValue()));
      this.reference.set(reference);
      this.form.reset();
    } catch (error) {
      this.error.set(apiMessage(error, 'We could not save your message. Try sending it again.'));
    } finally {
      this.sending.set(false);
    }
  }
}
