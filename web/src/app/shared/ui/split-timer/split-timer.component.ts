import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DurationPipe } from '../../../core/time/duration';

export type SplitSide = 'left' | 'right';

/**
 * Two independent timers side by side, Left and Right (spec 05; reused by Pump): each shows its own
 * duration and a Start Left / Start Right button (M3 tonal), which becomes a filled Stop while that
 * side runs. `markedSide` gets `markLabel` above its timer (e.g. "last side"). When `editable`, a
 * pencil under each duration emits `edit` so the caller can have it typed; `timersDisabled` turns off
 * Start/Stop only, `disabled` every button. Emits which side to start, stop or edit; the caller owns
 * the timing.
 */
@Component({
  selector: 'nala-split-timer',
  imports: [DurationPipe, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './split-timer.component.html',
  styleUrl: './split-timer.component.scss',
})
export class SplitTimerComponent {
  readonly leftSeconds = input.required<number>();
  readonly rightSeconds = input.required<number>();
  /** The side running now; null when none. */
  readonly running = input<SplitSide | null>(null);
  readonly markedSide = input<SplitSide | null>(null);
  readonly markLabel = input('');
  readonly disabled = input(false);
  readonly start = output<SplitSide>();
  readonly stop = output<SplitSide>();
  readonly editable = input(false);
  readonly timersDisabled = input(false);
  readonly edit = output<SplitSide>();

  protected readonly sides = [
    {
      side: 'left',
      label: 'splitTimer.left',
      startLabel: 'splitTimer.startLeft',
      editLabel: 'splitTimer.editLeft',
    },
    {
      side: 'right',
      label: 'splitTimer.right',
      startLabel: 'splitTimer.startRight',
      editLabel: 'splitTimer.editRight',
    },
  ] as const;

  protected seconds(side: SplitSide): number {
    return side === 'left' ? this.leftSeconds() : this.rightSeconds();
  }

  protected toggle(side: SplitSide): void {
    if (this.running() === side) {
      this.stop.emit(side);
    } else {
      this.start.emit(side);
    }
  }
}
