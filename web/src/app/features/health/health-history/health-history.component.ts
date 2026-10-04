import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { HealthEntryComponent } from '../health-entry/health-entry.component';

/**
 * The Health history page's list (spec 09): the selected baby's doses page by page, newest first; an
 * entry edited or deleted from it is updated in place. Loads again from the first page once changes
 * kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-health-history',
  imports: [HealthEntryComponent, HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-history.component.html',
})
export class HealthHistoryComponent {
  private readonly healthEntries = inject(HealthEntryService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly queue = inject(OfflineQueueService);
  private readonly list = viewChild<HistoryListComponent<HealthEntry>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<HealthEntry> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. once changes made offline were sent.
    this.queue.sent();
    return babyId ? (cursor) => this.healthEntries.page(babyId, cursor) : null;
  });

  protected edit(healthEntry: HealthEntry): void {
    this.entrySheets
      .edit('health', 'health', healthEntry)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<HealthEntry>));
  }
}
