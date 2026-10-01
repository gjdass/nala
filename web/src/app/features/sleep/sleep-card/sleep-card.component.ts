import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { sleepSeconds } from '../sleep-duration';
import { SleepEntryComponent } from '../sleep-entry/sleep-entry.component';

/**
 * The Sleep card on home (spec 06): the selected baby's sleeps of the last 24 hours (at least the 3
 * most recent) in the shared section card, with "Awake for" and the time since the latest sleep ended
 * (ticking), on the right that sleep's duration ("last sleep"), or an empty state without any sleep.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and once changes
 * kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-sleep-card',
  imports: [
    DurationPipe,
    EmptyStateComponent,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
    SleepEntryComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-card.component.html',
  styleUrl: './sleep-card.component.scss',
})
export class SleepCardComponent {
  private readonly sleeps = inject(SleepService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;
  private readonly queue = inject(OfflineQueueService);

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly Sleep[] | null>(null);
  /** The sleep that ended last; null without one. */
  protected readonly last = computed(() =>
    (this.entries() ?? [])
      .filter((sleep) => sleep.endTime !== null)
      .reduce<Sleep | null>(
        (latest, sleep) =>
          !latest || Date.parse(sleep.endTime!) > Date.parse(latest.endTime!) ? sleep : latest,
        null,
      ),
  );
  /** Since the last sleep ended. */
  protected readonly awakeSeconds = computed(() => {
    const last = this.last();
    return last ? Math.floor((this.now() - Date.parse(last.endTime!)) / 1000) : 0;
  });
  protected readonly lastSeconds = computed(() => {
    const last = this.last();
    return last ? (sleepSeconds(last) ?? 0) : 0;
  });
  private request?: Subscription;

  constructor() {
    effect(() => {
      const baby = this.store.selected();
      untracked(() => {
        this.entries.set(null);
        if (baby) {
          this.load(baby.id);
        }
      });
    });
    // Changes kept on the device (offline) have reached the server.
    let sent = this.queue.sent();
    effect(() => {
      const now = this.queue.sent();
      untracked(() => {
        if (now !== sent) {
          sent = now;
          this.reload();
        }
      });
    });
  }

  protected reload(): void {
    const baby = this.store.selected();
    if (baby) {
      this.load(baby.id);
    }
  }

  protected edit(sleep: Sleep): void {
    this.entrySheets
      .edit('sleep', 'sleep', sleep)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.sleeps.page(babyId, cursor),
      (sleep) => sleep.startTime,
      new Date(),
    ).subscribe({ next: (entries) => this.entries.set(entries) });
  }
}
