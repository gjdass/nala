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
import { pumpTotalMl } from '../../../core/pumps/pump';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { NowService } from '../../../core/time/now.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { PumpEntryComponent } from '../pump-entry/pump-entry.component';

/**
 * The Pump card on home (spec 08): the selected baby's pumping sessions of the last 24 hours (at
 * least the 3 most recent) in the shared section card, with "Last pumped" and the time since the
 * start of the most recent session that isn't live (pumping is scheduled start to start; in hours and
 * minutes only, see `HighlightDurationPipe`), on the right that session's total ("180 ml", "—"
 * without a volume), or an empty state without any session. Reloads after an entry is added, edited
 * or deleted, when another baby is selected, and once changes kept on the device (offline) have been
 * sent.
 */
@Component({
  selector: 'nala-pump-card',
  imports: [
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    PumpEntryComponent,
    SectionCardComponent,
    SectionEntryDirective,
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
  private readonly queue = inject(OfflineQueueService);

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly Pump[] | null>(null);
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
    ).subscribe({ next: (entries) => this.entries.set(entries) });
  }
}
