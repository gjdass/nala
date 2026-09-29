import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateTimePipe } from '../../../core/i18n/date-time';

/**
 * A pending invitation in a list: who created it and when it expires. Callers project a trailing
 * action (`invitationAction`). Place it in a `mat-list`.
 */
@Component({
  selector: 'nala-invitation-list-item',
  imports: [DateTimePipe, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invitation-list-item.component.html',
  styleUrl: './invitation-list-item.component.scss',
})
export class InvitationListItemComponent {
  readonly createdBy = input.required<string>();
  /** ISO date-time. */
  readonly expiresAt = input.required<string>();
}
