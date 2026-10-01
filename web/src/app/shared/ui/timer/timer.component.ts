import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { DurationPipe } from '../../../core/time/duration';

/**
 * A single timer (spec 06; reused by later timer sections): its duration and a Start button (M3
 * tonal), which becomes a filled Stop while it runs. Emits `start` or `stop`; the caller owns the
 * timing. `compact` is the smaller variant shown in a section card's running state.
 */
@Component({
  selector: 'nala-timer',
  imports: [DurationPipe, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.scss',
})
export class TimerComponent {
  readonly seconds = input.required<number>();
  readonly running = input(false);
  readonly disabled = input(false);
  readonly compact = input(false);
  readonly start = output<void>();
  readonly stop = output<void>();

  protected toggle(): void {
    if (this.running()) {
      this.stop.emit();
    } else {
      this.start.emit();
    }
  }
}
