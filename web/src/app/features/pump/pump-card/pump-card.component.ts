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
import { pumpTotalMl } from '../../../core/pumps/pump';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { PumpSyncService } from '../../../core/pumps/pump-sync.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { isLiveLongerThan } from '../../../core/time/live-longer-than';
import { NowService } from '../../../core/time/now.service';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { STILL_PUMPING_AFTER_MS } from '../pump-duration';
import { PumpEntryComponent } from '../pump-entry/pump-entry.component';

/**
 * The Pump card on home (spec 08): the selected baby's pumping sessions of the last 24 hours (at
 * least the 3 most recent) in the shared section card, with "Last pumped" and the time since the
 * start of the most recent session that isn't live (pumping is scheduled start to start; in hours and
 * minutes only, see `HighlightDurationPipe`), on the right that session's total ("180 ml", "—"
 * without a volume), or an empty state without any session.
 *
 * A live session (on any device, see `PumpSyncService`) changes nothing in the highlight (no timer on
 * the card, spec 04): the timer button opens it; a session live for more than 1 hour shows "Still
 * pumping?", whose Review opens it. The live session is listed as the shared state has it now, and the
 * card reloads when a session becomes live or stops anywhere. Reloads after an entry is added, edited
 * or deleted, when another baby is selected, and
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-pump-card',
  imports: [
    BannerComponent,
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    PumpEntryComponent,
    SectionCardComponent,
    SectionEntryDirective,
    TimeSincePipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-card.component.html',
  styleUrl: './pump-card.component.scss',
})
export class PumpCardComponent {
  private readonly pumps = inject(PumpService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;
  private readonly sync = inject(PumpSyncService);

  /** Newest first; null while loading. */
  private readonly loaded = signal<readonly Pump[] | null>(null);
  /** The loaded sessions, a live one as the shared state has it now (edited on any device). */
  protected readonly entries = computed(
    () =>
      this.loaded()?.map((pump) => this.sync.inProgress().find((p) => p.id === pump.id) ?? pump) ??
      null,
  );
  /** The selected baby's live session (the oldest with two). */
  protected readonly inProgress = computed(() => {
    const baby = this.store.selected();
    return baby ? this.sync.forBaby(baby.id) : null;
  });
  protected readonly stillPumping = computed(() => {
    const pump = this.inProgress();
    return pump && isLiveLongerThan(pump, STILL_PUMPING_AFTER_MS, this.now()) ? pump : null;
  });
  /** The session that isn't live with the latest start; null without one. */
  protected readonly last = computed(() =>
    (this.entries() ?? [])
      .filter((pump) => pump.endTime !== null)
      .reduce<Pump | null>(
        (latest, pump) =>
          !latest || Date.parse(pump.startTime) > Date.parse(latest.startTime) ? pump : latest,
        null,
      ),
  );
  protected readonly lastTotal = computed(() => {
    const last = this.last();
    return last ? pumpTotalMl(last) : null;
  });
  /** Since the last session started. */
  protected readonly sinceSeconds = computed(() => {
    const last = this.last();
    return last ? Math.floor((this.now() - Date.parse(last.startTime)) / 1000) : 0;
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
    // A session became live or stopped on any device: listed from its first Start, then the
    // highlight follows its end.
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

  protected edit(pump: Pump): void {
    this.entrySheets
      .edit('pump', 'pump', pump)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.pumps.page(babyId, cursor),
      (pump) => pump.startTime,
      new Date(),
    ).subscribe({ next: (entries) => this.loaded.set(entries) });
  }
}
