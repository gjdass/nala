import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { Baby, BabySheetResult } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryEndDirective } from '../../../shared/ui/history-list/history-end.directive';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { BabySheetComponent } from '../../babies/baby-sheet/baby-sheet.component';
import { GrowthBirthComponent } from '../growth-birth/growth-birth.component';
import { GrowthEntryComponent } from '../growth-entry/growth-entry.component';

/**
 * The Growth history page's list (spec 10): the selected baby's entries page by page, newest date
 * first, each with the baby's age on its date; an entry edited or deleted from it is updated in place.
 * After the last page, the Birth item when the baby has a birth measurement, opening the baby's
 * profile form. Loads again from the first page once changes kept on the device (offline) have been
 * sent.
 */
@Component({
  selector: 'nala-growth-history',
  imports: [
    GrowthBirthComponent,
    GrowthEntryComponent,
    HistoryEndDirective,
    HistoryListComponent,
    SectionEntryDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-history.component.html',
})
export class GrowthHistoryComponent {
  private readonly growthEntries = inject(GrowthEntryService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly queue = inject(OfflineQueueService);
  private readonly sheets = inject(SheetService);
  private readonly list = viewChild<HistoryListComponent<GrowthEntry>>(HistoryListComponent);

  protected readonly baby = computed(() => this.store.selected());
  protected readonly birthDate = computed(() => this.baby()?.birthDate ?? null);
  /** Whether the baby has a birth measurement, for the Birth item. */
  protected readonly hasBirth = computed(() => {
    const baby = this.baby();
    return (
      !!baby &&
      [baby.birthWeightG, baby.birthLengthCm, baby.birthHeadCircumferenceCm].some((v) => v !== null)
    );
  });
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

  /** Opens the baby's profile form (spec 03) and keeps the app's babies in step with its result. */
  protected editBaby(baby: Baby): void {
    this.sheets
      .open<BabySheetComponent, BabySheetResult>(BabySheetComponent, baby)
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if ('deleted' in result) {
          this.store.remove(result.deleted);
        } else {
          this.store.update(result.saved);
        }
      });
  }
}
