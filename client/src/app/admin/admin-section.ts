import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-section',
  imports: [RouterLink],
  template: `<main>
    <h1>{{ title }}</h1>
    <p>This section is scheduled for a later admin release.</p>
    <a class="secondary-button" routerLink="/admin">Back to dashboard</a>
  </main>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSection {
  protected readonly title = inject(ActivatedRoute).snapshot.data['label'];
}
