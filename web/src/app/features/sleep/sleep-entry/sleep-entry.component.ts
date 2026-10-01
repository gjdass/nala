import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { DurationPipe } from '../../../core/time/duration';
import { EntryTimePipe } from '../../../core/time/entry-time';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';
import { sleepSeconds } from '../sleep-duration';

/**
 * A sleep as an entry list item (spec 06), in the sleep card and history: the bedtime icon, its start
 * time, then its duration and when it ended ("1h 30m · until 2:30 PM"). Tapping it emits `open`.
 */
@Component({
  selector: 'nala-sleep-entry',
  imports: [DurationPipe, EntryListItemComponent, EntryTimePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-entry.component.html',
})
export class SleepEntryComponent {
  readonly sleep = input.required<Sleep>();
  readonly open = output<void>();

  /** Its duration; null while it is live (no end yet). */
  protected readonly seconds = computed(() => sleepSeconds(this.sleep()));
}
