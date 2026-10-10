import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { HistoryLoaderService } from '../../core/history/history-loader.service';
import { HistoryItem } from '../../core/history/history-source.models';
import { DataRefreshService, onReload } from '../../core/refresh/data-refresh.service';
import { HistoryPageLoader, SECTIONS, SectionKey } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { EntrySheetResult } from '../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../shared/ui/section-card/section-entry.directive';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { NoBabyComponent } from '../babies/no-baby/no-baby.component';
import {
  FilterBarSection,
  HistoryFilterBarComponent,
} from './filter-bar/history-filter-bar.component';
import { HistoryEntryComponent } from './history-entry/history-entry.component';
import {
  HistoryFilters,
  HistoryFiltersStore,
  HistoryWindow,
  WINDOW_HOURS,
} from './history-filters';

/**
 * The History destination (spec 11): the top bar with the selected baby, the filter bar (time window and
 * sections, remembered on the device), then the entries of the selected sections in the window, newest
 * first across sections, each its section's own list item; a tapped entry opens its sheet and is updated
 * in place. Opened from a card (`?section=<key>`), it shows that section over 7 days and saves nothing.
 * Without a baby, 03's empty state. The babies, the home order and the list load again on the reload
 * signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-history',
  imports: [
    HistoryEntryComponent,
    HistoryFilterBarComponent,
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
  private readonly filterStore = inject(HistoryFiltersStore);
  private readonly sections = inject(SECTIONS);
  private readonly list = viewChild<HistoryListComponent<HistoryItem>>(HistoryListComponent);

  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly store = inject(SelectedBabyService);

  /** The registered section of a card's All activities link, null when History is opened otherwise. */
  private readonly linked = computed(() => {
    const key = this.query()?.get('section');
    return this.sections.find((s) => s.key === key)?.key ?? null;
  });

  /** The link's filters, or the remembered ones; the filter bar changes them until the link changes. */
  protected readonly filters = linkedSignal((): HistoryFilters => {
    const linked = this.linked();
    return linked
      ? { window: '7d', sections: [linked] }
      : untracked(() => this.filterStore.read(this.sections.map((s) => s.key)));
  });

  /** The registered sections in the home order (the default one, all visible, until it is known). */
  protected readonly menuSections = computed((): FilterBarSection[] => {
    const order =
      this.preferences.preferences() ?? this.sections.map((s) => ({ key: s.key, visible: true }));
    return order.flatMap(({ key, visible }) => {
      const section = this.sections.find((s) => s.key === key);
      return section ? [{ key, icon: section.icon, visible }] : [];
    });
  });

  /**
   * A new loader (another baby, a filter change, the reload signal) starts again from the first page,
   * with a new window.
   */
  protected readonly loader = computed((): HistoryPageLoader<HistoryItem> | null => {
    const babyId = this.store.selected()?.id;
    const { window, sections } = this.filters();
    this.refresh.reload();
    if (!babyId) {
      return null;
    }
    // The home order only breaks ties: read once, so its arrival doesn't load the list again.
    const order = untracked(this.menuSections).map((s) => s.key);
    const keys = order.filter((key) => sections.includes(key));
    return this.loaders.loader(
      babyId,
      keys,
      new Date(Date.now() - WINDOW_HOURS[window] * 3_600_000),
    );
  });

  constructor() {
    const load = () => {
      this.store.refresh();
      this.preferences.load();
    };
    load();
    onReload(load);
  }

  protected setWindow(window: HistoryWindow): void {
    this.setFilters({ ...this.filters(), window });
  }

  protected setSections(sections: SectionKey[]): void {
    this.setFilters({ ...this.filters(), sections });
  }

  private setFilters(filters: HistoryFilters): void {
    this.filters.set(filters);
    if (!this.linked()) {
      this.filterStore.save(filters);
    }
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
