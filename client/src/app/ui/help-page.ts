import { FormField, FieldControl } from './form-field/form-field';
import { Magnetic } from '../motion/magnetic';
import { Reveal } from '../reveal';
import { Tilt } from '../motion/tilt';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StoreInformation } from '../store-footer/store-info';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';
import { FaqList } from './faq-list';
import { questions } from './faq-content';
import { indianPhoneValidator } from './indian-phone';
import { TicketStatus } from './ticket-status';

@Component({
  selector: 'app-help-page',
  imports: [FormField, FieldControl, Magnetic, Reveal, Tilt, FaqList, ReactiveFormsModule, TicketStatus, RouterLink, DatePipe],
  templateUrl: './help-page.html',
  styleUrl: './help-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly contactOnly = Boolean(this.route.snapshot.data['contactOnly']);
  protected readonly details = inject(StoreInformation).data;
  protected readonly questions = questions;
  private readonly http = inject(HttpClient);
  private readonly builder = inject(FormBuilder).nonNullable;
  protected readonly form = this.builder.group({
    name: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    phone: ['', [Validators.required, indianPhoneValidator]],
    category: [this.route.snapshot.queryParamMap.get('category') === 'privacy' ? 'privacy' : 'order', Validators.required],
    orderNumber: ['', Validators.pattern(/^AG-[0-9A-F]{14}$/i)],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    message: ['', [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)]],
  });
  protected readonly sending = signal(false);
  protected readonly receipt = signal<{ ticketNumber: string; acknowledgeBy: string } | null>(null);
  protected readonly error = signal('');

  protected fieldError(key: keyof typeof this.form.controls, message: string) {
    const control = this.form.controls[key];
    return control.touched && control.invalid ? message : undefined;
  }

  protected async submit(element: HTMLFormElement) {
    if (this.sending()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) {
      element
        .querySelector<HTMLElement>('[aria-invalid="true"], input.ng-invalid, textarea.ng-invalid')
        ?.focus();
      return;
    }

    this.sending.set(true);
    this.receipt.set(null);
    try {
      const receipt = await firstValueFrom(
        this.http.post<{ ticketNumber: string; acknowledgeBy: string }>('/api/support', {
          ...this.form.getRawValue(), orderNumber: this.form.controls.orderNumber.value.toUpperCase(),
        }),
      );
      this.receipt.set(receipt);
      this.form.reset();
    } catch (error) {
      this.error.set(apiMessage(error, 'We could not save your message. Try sending it again.'));
    } finally {
      this.sending.set(false);
    }
  }
}
