import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DurationPipe } from '../../../core/time/duration';
import { EntryTimePipe } from '../../../core/time/entry-time';

/**
 * One entry of a section (card list and history, spec 04): kind icon, local time, summary, an optional
 * duration bar (duration / section scale, capped at full width) with the duration, and a chevron.
 * Tapping it emits `open`. Place it in a `mat-action-list`; the bar takes `--nala-entry-bar`.
 */
@Component({
  selector: 'nala-entry-list-item',
  imports: [DurationPipe, EntryTimePipe, MatIconModule, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-list-item.component.html',
  styleUrl: './entry-list-item.component.scss',
})
export class EntryListItemComponent {
  /** Material Symbols name of the entry's kind. */
  readonly icon = input.required<string>();
  /** ISO date-time the entry happened. */
  readonly time = input.required<string>();
  readonly summary = input('');
  readonly durationSeconds = input<number | null>(null);
  /** The duration that fills the whole bar, set by the section. */
  readonly durationScaleSeconds = input(3600);
  readonly open = output<void>();

  protected readonly barWidth = computed(() => {
    const duration = this.durationSeconds() ?? 0;
    return `${Math.min(100, (duration / this.durationScaleSeconds()) * 100)}%`;
  });
}
