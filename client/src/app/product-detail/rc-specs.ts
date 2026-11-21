import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { categoryLabels, type RcProduct } from '../catalog/product';

@Component({
  selector: 'app-rc-specs',
  template: `
    <table aria-label="RC specifications">
      <tbody>
        @for (row of rows(); track row.label) {
          <tr><th scope="row"><span aria-hidden="true">{{ row.icon }}</span> {{ row.label }}</th><td>{{ row.value }}</td></tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    table { width: 100%; border-collapse: collapse; text-align: left; }
    tr + tr { border-top: 1px solid var(--line); }
    th, td { padding: .55rem .4rem; vertical-align: top; }
    th span { display: inline-block; min-width: 1.25rem; text-align: center; color: var(--amber); }
    td { color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RcSpecs {
  readonly product = input.required<RcProduct>();

  protected readonly rows = computed(() => {
    const item = this.product();
    return [
      { label: 'Type', icon: '◆', value: categoryLabels[item.category] },
      { label: 'Brand', icon: '◆', value: item.brand },
      { label: 'Scale', icon: '↔', value: item.scale },
      { label: 'Battery type', icon: 'ϟ', value: item.batteryType },
      { label: 'Battery included', icon: 'ϟ', value: item.batteryIncluded ? 'Yes' : 'No' },
      { label: 'Run time', icon: '◷', value: item.runTime && `${item.runTime} min` },
      { label: 'Charge time', icon: '◷', value: item.chargeTime && `${item.chargeTime} min` },
      { label: 'Top speed', icon: '»', value: item.topSpeed && `${item.topSpeed} km/h` },
      { label: 'Control range', icon: '↔', value: item.controlRange && `${item.controlRange} m` },
      { label: 'Control type', icon: '◎', value: item.controlType === 'app' ? 'App' : item.controlType },
      { label: 'Terrain', icon: '▧', value: item.terrain },
      { label: 'Skill level', icon: '▲', value: item.skillLevel },
      { label: 'Recommended age', icon: '○', value: `${item.recommendedAge}+` },
      { label: 'Ready to run', icon: '✓', value: item.readyToRun ? 'Yes' : 'No' },
      { label: 'Warranty', icon: '◇', value: item.warrantyDays ? `${item.warrantyDays} days` : 'No warranty listed' },
    ].filter(({ value }) => value);
  });
}
