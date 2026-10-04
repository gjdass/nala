import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { EntryDatePipe, EntryTimePipe } from '../../../core/time/entry-time';

/**
 * One entry of a section (card list and history, spec 04), always a two-line item so every row has the same
 * height: kind icon, headline "time · label" (label optional; the date instead of the time with `dateOnly`),
 * the summary on one line (ellipsis), a chevron. Tapping it emits `open`. Place it in a `mat-action-list`.
 */
@Component({
  selector: 'nala-entry-list-item',
  imports: [EntryDatePipe, EntryTimePipe, MatIconModule, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-list-item.component.html',
  styleUrl: './entry-list-item.component.scss',
})
export class EntryListItemComponent {
  /** Material Symbols name of the entry's kind. */
  readonly icon = input.required<string>();
  /** ISO date-time the entry happened. */
  readonly time = input.required<string>();
  /** The entry is dated without a time (spec 10): the headline shows its date ("Today", "Sep 28"). */
  readonly dateOnly = input(false, { transform: booleanAttribute });
  /** Shown after the time in the headline (e.g. "Lunch · Liked"). */
  readonly label = input('');
  readonly summary = input('');
  readonly open = output<void>();
}
