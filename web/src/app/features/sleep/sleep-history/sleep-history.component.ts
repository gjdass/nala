import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { SleepEntryComponent } from '../sleep-entry/sleep-entry.component';

/**
 * The Sleep history page's list (spec 06): the selected baby's sleeps page by page, newest first; an
 * entry edited or deleted from it is updated in place. Loads again from the first page once changes
 * kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-sleep-history',
  imports: [HistoryListComponent, SectionEntryDirective, SleepEntryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-history.component.html',
})
export class SleepHistoryComponent {
  private readonly sleeps = inject(SleepService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly queue = inject(OfflineQueueService);
  private readonly list = viewChild<HistoryListComponent<Sleep>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<Sleep> | null => {
    const babyId = this.store.selected()?.id;
    // A new loader starts again from the first page, e.g. once changes made offline were sent.
    this.queue.sent();
    return babyId ? (cursor) => this.sleeps.page(babyId, cursor) : null;
  });

  protected edit(sleep: Sleep): void {
    this.entrySheets
      .edit('sleep', 'sleep', sleep)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<Sleep>));
  }
}
