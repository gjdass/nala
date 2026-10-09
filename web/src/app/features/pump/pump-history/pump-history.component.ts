import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { PumpEntryComponent } from '../pump-entry/pump-entry.component';

/**
 * The Pump history page's list (spec 08): the selected baby's pumping sessions page by page, newest first; an
 * entry edited or deleted from it is updated in place. Loads again from the first page
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-pump-history',
  imports: [HistoryListComponent, PumpEntryComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-history.component.html',
})
export class PumpHistoryComponent {
  private readonly pumps = inject(PumpService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly refresh = inject(DataRefreshService);
  private readonly list = viewChild<HistoryListComponent<Pump>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<Pump> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. on the reload signal.
    this.refresh.reload();
    return babyId ? (cursor) => this.pumps.page(babyId, cursor) : null;
  });

  protected edit(pump: Pump): void {
    this.entrySheets
      .edit('pump', 'pump', pump)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<Pump>));
  }
}
