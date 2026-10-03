import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { SECTIONS } from '../../../core/sections/section.models';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { RunningTimer } from '../../../core/timers/running-timer.models';
import { RunningTimersService } from '../../../core/timers/running-timers.service';
import { EntrySheetService } from '../entry-sheet/entry-sheet.service';

/**
 * The running timers mini-bar (spec 04), shown inside the bottom navigation bar's pill while a timer
 * runs: one list item per timer (section icon in a circle in the section's container colours, label,
 * the baby's name when the family has several, live duration, chevron); tapping one opens that timer's entry sheet. Renders nothing when none runs.
 */
@Component({
  selector: 'nala-running-timers-bar',
  imports: [DurationPipe, MatIconModule, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './running-timers-bar.component.html',
  styleUrl: './running-timers-bar.component.scss',
})
export class RunningTimersBarComponent {
  private readonly now = inject(NowService).now;
  private readonly babies = inject(SelectedBabyService).babies;
  private readonly icons = new Map(inject(SECTIONS).map((s) => [s.key, s.icon]));
  private readonly entrySheets = inject(EntrySheetService);
  private readonly timers = inject(RunningTimersService).timers;

  protected readonly rows = computed(() => {
    const now = this.now();
    const babies = this.babies() ?? [];
    const names = babies.length > 1 ? new Map(babies.map((b) => [b.id, b.name])) : null;
    return this.timers().map((timer) => ({
      timer,
      icon: this.icons.get(timer.section) ?? '',
      baby: names?.get(timer.babyId) ?? null,
      seconds: timer.seconds(now),
    }));
  });

  protected open(timer: RunningTimer): void {
    this.entrySheets.edit(timer.section, timer.kind, timer.entry).subscribe();
  }
}
