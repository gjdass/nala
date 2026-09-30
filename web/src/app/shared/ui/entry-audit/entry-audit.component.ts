import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EntryTimePipe } from '../../../core/time/entry-time';

/**
 * Who logged an entry, and who edited it last and when, at the bottom of its sheet in edit mode:
 * "Logged by Anna · Edited by Ben, 2:40 PM". A deleted account keeps its display name.
 */
@Component({
  selector: 'nala-entry-audit',
  imports: [EntryTimePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-audit.component.html',
  styleUrl: './entry-audit.component.scss',
})
export class EntryAuditComponent {
  readonly loggedBy = input.required<string>();
  /** Null while the entry was never edited. */
  readonly editedBy = input<string | null>(null);
  /** ISO date-time of the last edit. */
  readonly editedAt = input<string | null>(null);
}
