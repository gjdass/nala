import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { GrowthEntryComponent } from '../growth-entry/growth-entry.component';

/**
 * The Growth history page's list (spec 10): the selected baby's entries page by page, newest date
 * first, each with the baby's age on its date; an entry edited or deleted from it is updated in place.
 * Loads again from the first page once changes kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-growth-history',
  imports: [GrowthEntryComponent, HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-history.component.html',
})
export class GrowthHistoryComponent {
  private readonly growthEntries = inject(GrowthEntryService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly queue = inject(OfflineQueueService);
  private readonly list = viewChild<HistoryListComponent<GrowthEntry>>(HistoryListComponent);

  protected readonly birthDate = computed(() => this.store.selected()?.birthDate ?? null);
  protected readonly loader = computed((): HistoryPageLoader<GrowthEntry> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. once changes made offline were sent.
    this.queue.sent();
    return babyId ? (cursor) => this.growthEntries.page(babyId, cursor) : null;
  });

  protected edit(growthEntry: GrowthEntry): void {
    this.entrySheets
      .edit('growth', growthEntry.kind, growthEntry)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<GrowthEntry>));
  }
}
