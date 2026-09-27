import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * A family member in a list: display name, email and admin badge. Callers project an extra
 * supporting line (`memberDetail`) and a trailing action (`memberAction`). Place it in a `mat-list`.
 */
@Component({
  selector: 'nala-member-list-item',
  imports: [MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-list-item.component.html',
  styleUrl: './member-list-item.component.scss',
})
export class MemberListItemComponent {
  readonly displayName = input.required<string>();
  readonly email = input.required<string>();
  readonly isAdmin = input(false);
}
