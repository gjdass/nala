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
import { MedicationDosePipe } from '../../../core/medications/medication-dose';
import { Medication } from '../../../core/medications/medication.models';
import { MedicationService } from '../../../core/medications/medication.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { NowService } from '../../../core/time/now.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { MedicationEntryComponent } from '../medication-entry/medication-entry.component';

/**
 * The Medication card on home (spec 09): the selected baby's doses of the last 24 hours (at least the
 * 3 most recent) in the shared section card, with "Last dose" and the time since the most recent dose
 * (in hours and minutes only, see `HighlightDurationPipe`), on the right that dose's name with its
 * dose under it when it has one, or an empty state without any dose. Reloads after an entry is added,
 * edited or deleted, when another baby is selected, and once changes kept on the device (offline)
 * have been sent.
 */
@Component({
  selector: 'nala-medication-card',
  imports: [
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    MedicationDosePipe,
    MedicationEntryComponent,
    SectionCardComponent,
    SectionEntryDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './medication-card.component.html',
  styleUrl: './medication-card.component.scss',
})
export class MedicationCardComponent {
  private readonly medications = inject(MedicationService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;
  private readonly queue = inject(OfflineQueueService);

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly Medication[] | null>(null);
  /** The dose with the latest time; null without one. */
  protected readonly last = computed(() =>
    (this.entries() ?? []).reduce<Medication | null>(
      (latest, medication) =>
        !latest || Date.parse(medication.time) > Date.parse(latest.time) ? medication : latest,
      null,
    ),
  );
  /** Since the last dose. */
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

  protected edit(medication: Medication): void {
    this.entrySheets
      .edit('medication', 'medication', medication)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.medications.page(babyId, cursor),
      (medication) => medication.time,
      new Date(),
    ).subscribe({ next: (entries) => this.entries.set(entries) });
  }
}
