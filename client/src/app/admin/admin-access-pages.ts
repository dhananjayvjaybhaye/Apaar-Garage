import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { adminNavigation } from './admin.config';
import { AdminSessionStore } from './admin-session-store';

const actionLabels = new Map<string, string>([
  ...adminNavigation.map(({ permission, label }): [string, string] => [permission, 'Open ' + label]),
  ['products.write', 'Create or edit products'],
  ['products.import', 'Import or export products'],
  ['admin-users.manage', 'Manage administrator accounts'],
]);

@Component({
  imports: [RouterLink],
  template: `
    <main class="admin-box">
      <h1 #heading tabindex="-1">You don't have access</h1>
      @if (!sessions.hasPermissions()) {
        <p role="alert">The admin server is out of date. Restart it.</p>
      } @else {
        @if (missing(); as action) {
          <p>Missing permission <strong>{{ action }}</strong>.</p>
        } @else {
          <p>Your administrator permissions do not allow this page.</p>
        }
        @if (sessions.can('dashboard.read')) {
          <a class="secondary-button" routerLink="/admin">Back to dashboard</a>
        }
        <h2>Sections you can use</h2>
        <ul>
          @for (section of sessions.sections(); track section.path) {
            <li><a [routerLink]="section.path">{{ section.label }}</a></li>
          }
        </ul>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNoAccess {
  protected readonly sessions = inject(AdminSessionStore);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly missing = computed(() => actionLabels.get(this.query()?.get('permission') ?? ''));
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }
}

@Component({
  template: `
    <main class="admin-box">
      <h1>Admin users</h1>
      <p>Grant or remove administrator access using the server's terminal commands.</p>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {}
