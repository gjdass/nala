import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { TimerComponent } from '../../../shared/ui/timer/timer.component';
import { isStillSleeping, sleepSeconds } from '../sleep-duration';
import { SleepEntryComponent } from '../sleep-entry/sleep-entry.component';

/**
 * The Sleep card on home (spec 06): the selected baby's sleeps of the last 24 hours (at least the 3
 * most recent) in the shared section card, with "Awake for" and the time since the latest sleep ended
 * (ticking), on the right that sleep's duration ("last sleep"), or an empty state without any sleep.
 *
 * While the baby has a live sleep (on any device, see `SleepSyncService`), the highlight is replaced
 * by "Sleeping" (opens the sheet) and the compact timer with its live duration and Stop; a sleep live
 * for more than 12 hours shows "Still sleeping?", whose Review opens it. The live sleep is listed as
 * the shared state has it now, and the card reloads when a sleep becomes live or stops anywhere.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and once changes
 * kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-sleep-card',
  imports: [
    BannerComponent,
    DurationPipe,
    EmptyStateComponent,
    MatButtonModule,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
    SleepEntryComponent,
    TimeSincePipe,
    TimerComponent,
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
  private readonly sync = inject(SleepSyncService);

  /** Newest first; null while loading. */
  private readonly loaded = signal<readonly Sleep[] | null>(null);
  /** The loaded sleeps, a live one as the shared state has it now (edited on any device). */
  protected readonly entries = computed(
    () =>
      this.loaded()?.map(
        (sleep) => this.sync.inProgress().find((s) => s.id === sleep.id) ?? sleep,
      ) ?? null,
  );
  /** The selected baby's live sleep (the oldest with two). */
  protected readonly inProgress = computed(() => {
    const baby = this.store.selected();
    return baby ? this.sync.forBaby(baby.id) : null;
  });
  protected readonly liveSeconds = computed(() => {
    const sleep = this.inProgress();
    return sleep ? Math.max(0, sleepSeconds(sleep, this.now()) ?? 0) : 0;
  });
  protected readonly stillSleeping = computed(() => {
    const sleep = this.inProgress();
    return sleep && isStillSleeping(sleep, this.now()) ? sleep : null;
  });
  /** Sending a Stop. */
  protected readonly busy = signal(false);
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
        this.loaded.set(null);
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
    // A sleep became live or stopped on any device: listed from its first Start, then the highlight
    // follows its end.
    let shown: { babyId: string; id: string | null } | null = null;
    effect(() => {
      const babyId = this.store.selected()?.id ?? null;
      const id = this.inProgress()?.id ?? null;
      untracked(() => {
        if (babyId && shown?.babyId === babyId && shown.id !== id) {
          this.load(babyId);
        }
        shown = babyId ? { babyId, id } : null;
      });
    });
  }

  protected stop(): void {
    const sleep = this.inProgress();
    if (!sleep || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.sleeps.stop(sleep.id, new Date().toISOString()).subscribe((result) => {
      this.busy.set(false);
      if (result.ok && result.queued) {
        this.sync.applyWaiting(sleep);
      } else if (result.ok) {
        this.sync.put(result.entry);
      }
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
    ).subscribe({ next: (entries) => this.loaded.set(entries) });
  }
}
