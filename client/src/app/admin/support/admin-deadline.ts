import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';

export function deadlineClock() {
  return toSignal(interval(30_000).pipe(map(() => Date.now())), { initialValue: Date.now() });
}

@Component({
  selector: 'app-admin-deadline',
  imports: [DatePipe],
  template: `
    @if (due(); as deadline) {
      <span class="admin-badge" [class.overdue]="state() === 'Overdue' || state() === 'Late'">{{ state() }}</span>
      <div><time [attr.datetime]="deadline">{{ deadline | date: 'medium' : '+0530' }} IST</time></div>
    } @else { <span>—</span> }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDeadline {
  readonly due = input<string>();
  readonly completed = input<string>();
  readonly now = input.required<number>();
  protected readonly state = computed(() => {
    const due = Date.parse(this.due() ?? '');
    const complete = this.completed();
    if (complete) return Date.parse(complete) > due ? 'Late' : 'Met';
    return this.now() >= due ? 'Overdue' : 'Due';
  });
}
