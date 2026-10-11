import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { CurrentFamilyService } from '../../core/families/current-family.service';
import { onReload } from '../../core/refresh/data-refresh.service';
import { SECTIONS } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { NoBabyComponent } from '../babies/no-baby/no-baby.component';
import { NoFamilyComponent } from '../babies/no-family/no-family.component';
import { FilterBarSection } from '../history/filter-bar/history-filter-bar.component';
import { TrendsFilterBarComponent } from './filter-bar/trends-filter-bar.component';
import {
  TRENDS_SECTIONS,
  TrendsFilters,
  TrendsFiltersStore,
  TrendsSection,
} from './trends-filters';
import { TrendsRange, canGoBack, canGoForward, period, periodLabel } from './trends-period';

/**
 * The Trends destination (spec 12): the top bar with the selected baby, then the filter bar (section,
 * range and period navigation; the section and range are remembered on the device). Without a baby, or
 * in no family, 03's empty states. The babies and the home order load again on the reload signal
 * (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-trends',
  imports: [
    NoBabyComponent,
    NoFamilyComponent,
    TopAppBarComponent,
    TrendsFilterBarComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trends.page.html',
  styleUrl: './trends.page.scss',
})
export class TrendsPage {
  private readonly preferences = inject(SectionPreferencesService);
  private readonly filterStore = inject(TrendsFiltersStore);
  private readonly sections = inject(SECTIONS);
  private readonly transloco = inject(TranslocoService);

  protected readonly store = inject(SelectedBabyService);
  protected readonly families = inject(CurrentFamilyService);

  /** Read once: the periods end today for as long as the page is open. */
  private readonly today = new Date();

  protected readonly filters = linkedSignal(() => untracked(() => this.filterStore.read()));

  /** 0 is the current period, -1 the one before, and so on. */
  protected readonly offset = signal(0);

  /** The sections with trends in the home order (the default one, all visible, until it is known). */
  protected readonly menuSections = computed((): FilterBarSection[] => {
    const order =
      this.preferences.preferences() ?? this.sections.map((s) => ({ key: s.key, visible: true }));
    return order.flatMap(({ key, visible }) => {
      const section = this.sections.find((s) => s.key === key);
      return section && (TRENDS_SECTIONS as readonly string[]).includes(key)
        ? [{ key, icon: section.icon, visible }]
        : [];
    });
  });

  /** The remembered section, else the first visible one, else the first in home order. */
  protected readonly section = computed((): TrendsSection => {
    const sections = this.menuSections();
    const first = sections.find((s) => s.visible) ?? sections[0];
    return this.filters().section ?? (first?.key as TrendsSection | undefined) ?? 'feed';
  });

  private readonly birthDate = computed(() => this.store.selected()?.birthDate ?? '');

  protected readonly period = computed(() =>
    period(this.filters().range, this.offset(), this.today, this.birthDate()),
  );
  protected readonly canGoBack = computed(() => canGoBack(this.period(), this.birthDate()));
  protected readonly canGoForward = computed(() => canGoForward(this.offset()));
  protected readonly navigable = computed(() => this.filters().range !== 'birth');

  protected readonly label = computed(() =>
    periodLabel(this.period(), this.filters().range, this.transloco.getActiveLang(), this.today),
  );

  constructor() {
    const load = () => {
      this.store.refresh();
      this.preferences.load();
    };
    load();
    onReload(load);
  }

  protected setSection(section: TrendsSection): void {
    this.setFilters({ ...this.filters(), section });
  }

  protected setRange(range: TrendsRange): void {
    this.setFilters({ ...this.filters(), range });
  }

  private setFilters(filters: TrendsFilters): void {
    this.filters.set(filters);
    this.offset.set(0);
    this.filterStore.save(filters);
  }
}
