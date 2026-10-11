import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { CurrentFamilyService } from '../../core/families/current-family.service';
import { onReload } from '../../core/refresh/data-refresh.service';
import { menuSections } from '../../core/sections/section-menu';
import { SECTIONS } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { NoBabyComponent } from '../babies/no-baby/no-baby.component';
import { NoFamilyComponent } from '../babies/no-family/no-family.component';
import { DiaperTrendsComponent } from './diaper/diaper-trends.component';
import { TrendsFilterBarComponent } from './filter-bar/trends-filter-bar.component';
import { PumpTrendsComponent } from './pump/pump-trends.component';
import { SleepTrendsComponent } from './sleep/sleep-trends.component';
import {
  TRENDS_SECTIONS,
  TrendsFilters,
  TrendsFiltersStore,
  TrendsSection,
} from './trends-filters';
import { TrendsRange, canGoBack, canGoForward, period, periodLabel } from './trends-period';

/**
 * The Trends destination (spec 12): the top bar with the selected baby, then the filter bar (section,
 * range and period navigation; the section and range are remembered on the device), then the section's
 * metric cards. Without a baby, or
 * in no family, 03's empty states. The babies, the home order and today load again on the reload signal
 * (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-trends',
  imports: [
    DiaperTrendsComponent,
    NoBabyComponent,
    NoFamilyComponent,
    PumpTrendsComponent,
    SleepTrendsComponent,
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
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly store = inject(SelectedBabyService);
  protected readonly families = inject(CurrentFamilyService);

  /** The periods end today: read again on the reload signal, so a page left open overnight moves on. */
  protected readonly today = signal(startOfToday(), {
    equal: (a, b) => a.getTime() === b.getTime(),
  });

  protected readonly filters = signal(this.filterStore.read());

  /** The sections with trends in the home order (the default one, all visible, until it is known). */
  protected readonly menuSections = computed(() =>
    menuSections(this.preferences.preferences(), this.sections, TRENDS_SECTIONS),
  );

  /** The remembered section, else the first visible one, else the first in home order. */
  protected readonly section = computed((): TrendsSection => {
    const sections = this.menuSections();
    const first = sections.find((s) => s.visible) ?? sections[0];
    return this.filters().section ?? (first?.key as TrendsSection | undefined) ?? 'feed';
  });

  private readonly birthDate = computed(() => this.store.selected()?.birthDate ?? '');

  /**
   * 0 is the current period, -1 the one before, and so on. Back to the current one when the baby, the
   * section, the range or the day changes.
   */
  protected readonly offset = linkedSignal({
    source: () =>
      [
        this.store.selected()?.id,
        this.section(),
        this.filters().range,
        this.today().getTime(),
      ].join('|'),
    computation: () => 0,
  });

  protected readonly period = computed(() =>
    period(this.filters().range, this.offset(), this.today(), this.birthDate()),
  );
  protected readonly canGoBack = computed(() => canGoBack(this.period(), this.birthDate()));
  protected readonly canGoForward = computed(() => canGoForward(this.offset()));
  protected readonly navigable = computed(() => this.filters().range !== 'birth');

  protected readonly label = computed(() =>
    periodLabel(this.period(), this.filters().range, this.lang(), this.today()),
  );

  constructor() {
    const load = () => {
      this.store.refresh();
      this.preferences.load();
      this.today.set(startOfToday());
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
    this.filterStore.save(filters);
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
