import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { HistoryLoaderService } from '../../core/history/history-loader.service';
import { HistoryItem } from '../../core/history/history-source.models';
import { DataRefreshService, onReload } from '../../core/refresh/data-refresh.service';
import { SECTION_KEYS, SectionKey, HistoryPageLoader } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { EntrySheetResult } from '../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../shared/ui/section-card/section-entry.directive';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { NoBabyComponent } from '../babies/no-baby/no-baby.component';
import { HistoryEntryComponent } from './history-entry/history-entry.component';

/** The sections History shows by default (spec 11). */
const DEFAULT_SECTIONS: readonly SectionKey[] = ['feed', 'sleep', 'diaper'];

/** The default time window: the last 24 h. */
const WINDOW_MS = 24 * 3_600_000;

/**
 * The History destination (spec 11): the top bar with the selected baby, then the entries of the
 * selected sections in the time window, newest first across sections, each its section's own list item;
 * a tapped entry opens its sheet and is updated in place. Without a baby, 03's empty state. The babies,
 * the home order and the list load again on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-history',
  imports: [
    HistoryEntryComponent,
    HistoryListComponent,
    NoBabyComponent,
    SectionEntryDirective,
    TopAppBarComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage {
  private readonly loaders = inject(HistoryLoaderService);
  private readonly preferences = inject(SectionPreferencesService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly refresh = inject(DataRefreshService);
  private readonly list = viewChild<HistoryListComponent<HistoryItem>>(HistoryListComponent);

  protected readonly store = inject(SelectedBabyService);

  /** A new loader (another baby, the reload signal) starts again from the first page, with a new window. */
  protected readonly loader = computed((): HistoryPageLoader<HistoryItem> | null => {
    const babyId = this.store.selected()?.id;
    this.refresh.reload();
    if (!babyId) {
      return null;
    }
    // The home order only breaks ties: read once, so its arrival doesn't load the list again.
    const order = untracked(this.preferences.preferences)?.map((p) => p.key) ?? SECTION_KEYS;
    const keys = order.filter((key) => DEFAULT_SECTIONS.includes(key));
    return this.loaders.loader(babyId, keys, new Date(Date.now() - WINDOW_MS));
  });

  constructor() {
    const load = () => {
      this.store.refresh();
      this.preferences.load();
    };
    load();
    onReload(load);
  }

  protected edit(item: HistoryItem): void {
    this.loaders.source(item.section).then((source) =>
      this.entrySheets
        .edit(item.section, source.kind(item.entry), item.entry)
        .pipe(filter((result) => result !== undefined))
        .subscribe((result) => this.list()?.apply(this.toItem(item, result))),
    );
  }

  /** The sheet's result as a result on History's items. */
  private toItem(item: HistoryItem, result: EntrySheetResult): EntrySheetResult<HistoryItem> {
    return 'saved' in result
      ? { saved: { ...item, entry: result.saved as HistoryItem['entry'] } }
      : (result as EntrySheetResult<HistoryItem>);
  }
}
