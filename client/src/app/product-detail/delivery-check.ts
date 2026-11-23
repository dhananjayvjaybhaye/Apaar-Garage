import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';

@Component({
  selector: 'app-delivery-check',
  template: `
    <form (submit)="check($event, pin.value)">
      <label>Delivery pincode
        <input #pin type="text" inputmode="numeric" autocomplete="postal-code" maxlength="6" [disabled]="busy()" aria-describedby="delivery-pin-help" [attr.aria-invalid]="invalid()" placeholder="6 digits" (input)="result.set(null); error.set(''); invalid.set(false)" />
      </label>
      <button class="secondary-button" type="submit" [disabled]="busy()">Check delivery</button>
    </form>
    @if (result(); as delivery) {
      <p role="status">{{ delivery.estimate }} {{ delivery.cod ? 'Cash on Delivery is available.' : 'Cash on Delivery is unavailable for this pincode.' }}</p>
    }
    <p id="delivery-pin-help" [class.error-text]="error()" [attr.role]="error() ? 'alert' : null">{{ error() || 'Use your 6-digit Indian pincode.' }}</p>
  `,
  styles: `
    :host { display:block; margin-top:1rem; }
    form { display:flex; flex-wrap:wrap; gap:.5rem; align-items:end; }
    label { display:grid; gap:.25rem; }
    input { width:8rem; max-width:100%; min-height:2.75rem; padding:.5rem; border:1px solid var(--line); border-radius:.5rem; background:var(--surface); color:inherit; }
    p { margin:.45rem 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryCheck {
  private readonly http = inject(HttpClient);
  protected readonly result = signal<{ estimate: string; cod: boolean } | null>(null);
  protected readonly invalid = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async check(event: Event, value: string) {
    event.preventDefault();
    this.result.set(null);
    this.error.set('');
    const pincode = value.trim();
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      this.invalid.set(true);
      this.error.set('Enter a valid 6-digit pincode.');
      return;
    }
    this.busy.set(true);
    try {
      this.result.set(await firstValueFrom(this.http.get<{ estimate: string; cod: boolean }>('/api/delivery', { params: { pincode } })));
    } catch (error) {
      this.error.set(apiMessage(error, 'Delivery information could not load. Try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
