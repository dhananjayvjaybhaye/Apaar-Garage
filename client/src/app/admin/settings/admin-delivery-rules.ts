import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import type { DeliveryRule } from './admin-settings-fields';

export type DeliveryRuleRow = DeliveryRule & { id: number };

@Component({
  selector: 'app-admin-delivery-rules',
  imports: [FieldControl, FormField],
  template: `
    <section class="admin-box">
      <h2>Pincode rules</h2>
      <p>The longest matching prefix applies. Without a match, the default delivery estimate applies.</p>
      @if (issues()['serviceablePincodeRules']; as issue) { <p class="error-text">{{ issue }}</p> }
      @if (!rules().length) { <p class="muted">No pincode overrides.</p> }
      @for (rule of rules(); track rule.id; let index = $index) {
        <div class="rule form-grid-container">
          <h3>Rule {{ index + 1 }}</h3>
          <div class="form-grid form-grid-compact">
            <app-form-field #prefix controlId="pincode-{{rule.id}}" label="Pincode prefix" [required]="true"
              [error]="error(index, 'prefix')">
              <input #prefixValue [appFieldControl]="prefix" required [value]="rule.prefix" inputmode="numeric"
                pattern="[1-9][0-9]{0,5}" maxlength="6" (input)="change(rule.id, { prefix: prefixValue.value })" />
            </app-form-field>
            <app-form-field #estimate controlId="estimate-{{rule.id}}" label="Delivery estimate" [required]="true"
              [error]="error(index, 'estimate')">
              <input #estimateValue [appFieldControl]="estimate" required [value]="rule.estimate" maxlength="180"
                (input)="change(rule.id, { estimate: estimateValue.value })" />
            </app-form-field>
          </div>
          <div class="admin-tools">
            <label><input #cod type="checkbox" [checked]="rule.cod" (change)="change(rule.id, { cod: cod.checked })" /> COD available</label>
            <label><input #serviceable type="checkbox" [checked]="rule.serviceable !== false"
              (change)="change(rule.id, { serviceable: serviceable.checked })" /> Serviceable</label>
            <button type="button" class="secondary-button" (click)="remove(rule.id)">Remove rule {{ index + 1 }}</button>
          </div>
        </div>
      }
      <button type="button" class="secondary-button" [disabled]="rules().length >= 500" (click)="add()">Add pincode rule</button>
    </section>
  `,
  styles: `
    .rule { border-block-start: 1px solid var(--line); margin-block: .75rem; padding-block-start: .75rem; }
    label { display: inline-flex; min-height: 2.75rem; align-items: center; gap: .3rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDeliveryRules {
  readonly rules = model.required<DeliveryRuleRow[]>();
  readonly issues = input.required<Record<string, string>>();

  protected error(index: number, field: string) {
    return this.issues()['serviceablePincodeRules.' + index + '.' + field];
  }

  protected add() {
    const id = Math.max(0, ...this.rules().map((rule) => rule.id)) + 1;
    this.rules.update((rules) => [...rules, { id, prefix: '', estimate: '', cod: true }]);
  }

  protected change(id: number, update: Partial<DeliveryRule>) {
    this.rules.update((rules) => rules.map((rule) => rule.id === id ? { ...rule, ...update } : rule));
  }

  protected remove(id: number) {
    this.rules.update((rules) => rules.filter((rule) => rule.id !== id));
  }
}
