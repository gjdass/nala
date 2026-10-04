import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { pumpTotalMl } from '../../../core/pumps/pump';
import { Pump } from '../../../core/pumps/pump.models';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { spanSeconds } from '../../../core/time/span-seconds';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A pumping session as an entry list item (spec 08), in the pump card and history: the water drop
 * icon, its start time and total ("2:30 PM · 180 ml", the time alone without a volume), then each
 * side and the duration ("L 90 ml · R 90 ml · 20m", a side without a volume left out). Tapping it
 * emits `open`.
 */
@Component({
  selector: 'nala-pump-entry',
  imports: [DurationPipe, EntryListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-entry.component.html',
})
export class PumpEntryComponent {
  readonly pump = input.required<Pump>();
  readonly open = output<void>();
  private readonly now = inject(NowService).now;

  protected readonly total = computed(() => pumpTotalMl(this.pump()));
  /** Which sides have a volume: the summary's translation key. */
  protected readonly sides = computed(() => {
    const { leftMl, rightMl } = this.pump();
    const left = leftMl !== null;
    const right = rightMl !== null;
    return left && right ? 'both' : left ? 'left' : right ? 'right' : 'none';
  });
  /** Its duration, live while it has no end. */
  protected readonly seconds = computed(() => spanSeconds(this.pump(), this.now()) ?? 0);
}
