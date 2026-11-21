import { Magnetic } from '../motion/magnetic';
import { Reveal } from '../reveal';
import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { AuthStore } from './auth-store';

@Component({
  selector: 'app-auth-page',
  imports: [Magnetic, Reveal, ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  private readonly accountForm = viewChild<ElementRef<HTMLFormElement>>('accountForm');
  protected readonly registering = this.route.snapshot.data['register'] === true;
  protected readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.formBuilder.group({
    name: ['', this.registering ? [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)] : []],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: [
      '',
      this.registering ? [Validators.required, Validators.minLength(8)] : [Validators.required],
    ],
  });

  constructor() {
    afterNextRender(() => this.accountForm()?.nativeElement.querySelector('input')?.focus());
  }

  protected fieldMessage(field: 'name' | 'email' | 'password') {
    const control = this.form.controls[field];
    if (!control.touched) return '';
    if (field === 'password' && new TextEncoder().encode(control.value).length > 72) {
      return 'Use a password that is 72 UTF-8 bytes or fewer.';
    }
    if (control.valid) return '';
    if (field === 'name') return 'Enter your name.';
    if (field === 'email') return 'Enter a valid email address.';
    return control.hasError('required') ? 'Enter your password.' : 'Use at least 8 characters.';
  }

  protected async submit() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    const invalidField = (['name', 'email', 'password'] as const).find((field) => this.fieldMessage(field));
    if (invalidField) {
      this.accountForm()?.nativeElement.querySelector<HTMLElement>('#account-' + invalidField)?.focus();
      return;
    }

    const { name, email, password } = this.form.getRawValue();
    this.busy.set(true);
    try {
      if (this.registering) {
        await this.auth.register({ name, email, password });
      } else {
        await this.auth.login({ email, password });
      }
      const requested = this.returnUrl ?? '';
      const catalog = requested === '/catalog' || requested.startsWith('/catalog?');
      const orderPage =
        requested === '/checkout' ||
        requested === '/orders' ||
        /^\/checkout\/success\/AG-[0-9A-F]{14}$/.test(requested);
      const internal =
        catalog || orderPage || /^\/(?:cart|product\/[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(requested);
      await this.router.navigateByUrl(internal ? requested : '/', { replaceUrl: true });
    } catch (error) {
      this.error.set(apiMessage(error, 'The account request failed. Try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
