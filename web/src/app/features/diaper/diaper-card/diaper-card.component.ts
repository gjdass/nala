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
import { diaperType } from '../../../core/diapers/diaper';
import { Diaper } from '../../../core/diapers/diaper.models';
import { DiaperService } from '../../../core/diapers/diaper.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { NowService } from '../../../core/time/now.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { DiaperEntryComponent } from '../diaper-entry/diaper-entry.component';

/**
 * The Diaper card on home (spec 07): the selected baby's diapers of the last 24 hours (at least the 3
 * most recent) in the shared section card, with "Last change" and the time since the most recent
 * diaper (in hours and minutes only, see `HighlightDurationPipe`), on the right that diaper's type,
 * marked "Rash" when it had one, or an empty state without any diaper. Reloads after an entry is
 * added, edited or deleted, when another baby is selected, and once changes kept on the device
 * (offline) have been sent.
 */
@Component({
  selector: 'nala-diaper-card',
  imports: [
    DiaperEntryComponent,
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diaper-card.component.html',
  styleUrl: './diaper-card.component.scss',
})
export class DiaperCardComponent {
  private readonly diapers = inject(DiaperService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;
  private readonly queue = inject(OfflineQueueService);

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly Diaper[] | null>(null);
  /** The diaper with the latest time; null without one. */
  protected readonly last = computed(() =>
    (this.entries() ?? []).reduce<Diaper | null>(
      (latest, diaper) =>
        !latest || Date.parse(diaper.time) > Date.parse(latest.time) ? diaper : latest,
      null,
    ),
  );
  protected readonly lastType = computed(() => {
    const last = this.last();
    return last ? diaperType(last) : null;
  });
  /** Since the last change. */
  protected readonly sinceSeconds = computed(() => {
    const last = this.last();
    return last ? Math.floor((this.now() - Date.parse(last.time)) / 1000) : 0;
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

  protected edit(diaper: Diaper): void {
    this.entrySheets
      .edit('diaper', 'diaper', diaper)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.diapers.page(babyId, cursor),
      (diaper) => diaper.time,
      new Date(),
    ).subscribe({ next: (entries) => this.entries.set(entries) });
  }
}
