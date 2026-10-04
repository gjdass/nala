import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Medication } from '../../../core/medications/medication.models';
import { MedicationService } from '../../../core/medications/medication.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { MedicationEntryComponent } from '../medication-entry/medication-entry.component';

/**
 * The Medication history page's list (spec 09): the selected baby's doses page by page, newest first; an
 * entry edited or deleted from it is updated in place. Loads again from the first page once changes
 * kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-medication-history',
  imports: [MedicationEntryComponent, HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './medication-history.component.html',
})
export class MedicationHistoryComponent {
  private readonly medications = inject(MedicationService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly queue = inject(OfflineQueueService);
  private readonly list = viewChild<HistoryListComponent<Medication>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<Medication> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. once changes made offline were sent.
    this.queue.sent();
    return babyId ? (cursor) => this.medications.page(babyId, cursor) : null;
  });

  protected edit(medication: Medication): void {
    this.entrySheets
      .edit('medication', 'medication', medication)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<Medication>));
  }
}
