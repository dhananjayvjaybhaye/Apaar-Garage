import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  template: `
    <main class="admin-box">
      <h1 #heading tabindex="-1">You don't have access</h1>
      <p>Your administrator permissions do not allow this page.</p>
      <a class="secondary-button" routerLink="/admin">Back to dashboard</a>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNoAccess {
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
