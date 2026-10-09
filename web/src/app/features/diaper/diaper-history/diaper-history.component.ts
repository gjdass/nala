import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Diaper } from '../../../core/diapers/diaper.models';
import { DiaperService } from '../../../core/diapers/diaper.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { DiaperEntryComponent } from '../diaper-entry/diaper-entry.component';

/**
 * The Diaper history page's list (spec 07): the selected baby's diapers page by page, newest first; an
 * entry edited or deleted from it is updated in place. Loads again from the first page
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-diaper-history',
  imports: [DiaperEntryComponent, HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diaper-history.component.html',
})
export class DiaperHistoryComponent {
  private readonly diapers = inject(DiaperService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly refresh = inject(DataRefreshService);
  private readonly list = viewChild<HistoryListComponent<Diaper>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<Diaper> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. on the reload signal.
    this.refresh.reload();
    return babyId ? (cursor) => this.diapers.page(babyId, cursor) : null;
  });

  protected edit(diaper: Diaper): void {
    this.entrySheets
      .edit('diaper', 'diaper', diaper)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<Diaper>));
  }
}
