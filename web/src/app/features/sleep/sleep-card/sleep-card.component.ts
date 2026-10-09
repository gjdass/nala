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
import { onReload } from '../../../core/refresh/data-refresh.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { NowService } from '../../../core/time/now.service';
import { spanSeconds } from '../../../core/time/span-seconds';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { isStillSleeping } from '../sleep-duration';
import { SleepEntryComponent } from '../sleep-entry/sleep-entry.component';

/**
 * The Sleep card on home (spec 06): the selected baby's sleeps of the last 24 hours (at least the 3
 * most recent) in the shared section card, with "Awake for" and the time since the latest sleep ended
 * (in hours and minutes only, see `HighlightDurationPipe`), on the right that sleep's duration ("last sleep"), or an empty state without any sleep.
 *
 * A live sleep (on any device, see `SleepSyncService`) changes nothing in the highlight (no timer on
 * the card, spec 04): the timer button opens it; a sleep live for more than 12 hours shows "Still
 * sleeping?", whose Review opens it. The live sleep is listed as
 * the shared state has it now, and the card reloads when a sleep becomes live or stops anywhere.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-sleep-card',
  imports: [
    BannerComponent,
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
    SleepEntryComponent,
    TimeSincePipe,
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
  protected readonly stillSleeping = computed(() => {
    const sleep = this.inProgress();
    return sleep && isStillSleeping(sleep, this.now()) ? sleep : null;
  });
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
    return last ? (spanSeconds(last) ?? 0) : 0;
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
    onReload(() => this.reload());
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
