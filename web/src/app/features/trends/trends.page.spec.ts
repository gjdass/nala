import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { By } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { FamiliesResult } from '../../core/families/family.models';
import { FamilyService } from '../../core/families/family.service';
import { DataRefreshService } from '../../core/refresh/data-refresh.service';
import {
  SECTIONS,
  SectionDefinition,
  SectionKey,
  SectionPreference,
} from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { TrendsService } from '../../core/trends/trends.service';
import { fakeDataRefresh } from '../../testing/data-refresh';
import { translocoTesting } from '../../testing/transloco-testing';
import { DiaperTrendsComponent } from './diaper/diaper-trends.component';
import { FeedTrendsComponent } from './feed/feed-trends.component';
import { GrowthTrendsComponent } from './growth/growth-trends.component';
import { PumpTrendsComponent } from './pump/pump-trends.component';
import { SleepTrendsComponent } from './sleep/sleep-trends.component';
import { TrendsPage } from './trends.page';

const section = (key: SectionKey): SectionDefinition =>
  ({ key, icon: key, kinds: [] }) as unknown as SectionDefinition;

describe('TrendsPage', () => {
  const NOW = new Date(2026, 9, 9, 12);

  let fixture: ComponentFixture<TrendsPage>;
  let babiesLoaded: Subject<BabiesResult>;
  let babiesRequests: number;
  let preferences: WritableSignal<SectionPreference[] | null>;
  let loadSections: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;
  let families: FamiliesResult;

  const lea = { id: 'b1', familyId: 'f1', name: 'Lea', birthDate: '2026-09-01' } as Baby;
  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (testId: string) => [
    ...document.querySelectorAll<HTMLButtonElement>(`[data-testid="${testId}"]`),
  ];
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const label = () => norm(find('period-label')?.textContent);
  const loadBabies = async (babies: Baby[]) => {
    babiesLoaded.next({ ok: true, babies });
    await fixture.whenStable();
  };
  const click = async (testId: string) => {
    find(testId)!.click();
    await fixture.whenStable();
  };
  const pick = async (chip: string, option: string, index: number) => {
    await click(chip);
    all(option)[index].click();
    await fixture.whenStable();
  };
  const saved = () => JSON.parse(localStorage.getItem('nala.trendsFilters')!);
  const create = async () => {
    fixture = TestBed.createComponent(TrendsPage);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    babiesLoaded = new Subject();
    babiesRequests = 0;
    families = { ok: true, families: [{ id: 'f1', name: 'Martins', isAdmin: true }] };
    preferences = signal<SectionPreference[] | null>(null);
    loadSections = vi.fn();
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [TrendsPage, translocoTesting()],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: SECTIONS,
          useValue: (['feed', 'sleep', 'diaper', 'pump', 'growth', 'health'] as const).map(section),
        },
        {
          provide: BabyService,
          useValue: {
            list: () => {
              babiesRequests++;
              return babiesLoaded;
            },
          },
        },
        { provide: FamilyService, useValue: { list: () => of(families) } },
        {
          provide: SectionPreferencesService,
          useValue: { preferences, load: loadSections, save: vi.fn() },
        },
        { provide: DataRefreshService, useValue: refresh },
        {
          provide: TrendsService,
          useValue: {
            sleeps: () => of([]),
            diapers: () => of([]),
            pumps: () => of([]),
            feeds: () => of([]),
            growth: () => of({ measurements: [], milestones: [] }),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('page', () => {
    beforeEach(create);

    it('shows the top app bar and the filter bar, and no page title nor add button', async () => {
      await loadBabies([lea]);

      expect(host().querySelector('nala-top-app-bar')).not.toBeNull();
      expect(find('selected-name')?.textContent?.trim()).toBe('Lea');
      expect(host().querySelector('nala-trends-filter-bar')).not.toBeNull();
      expect(host().querySelector('h1')).toBeNull();
      expect(host().querySelector('[mat-fab], [mat-mini-fab], nala-kind-picker')).toBeNull();
    });

    it('keeps the filter bar at the top while the page scrolls', async () => {
      await loadBabies([lea]);

      expect(getComputedStyle(host().querySelector('nala-trends-filter-bar')!).position).toBe(
        'sticky',
      );
    });

    it("shows 03's empty state without a baby", async () => {
      await loadBabies([]);

      expect(host().querySelector('nala-no-baby')).not.toBeNull();
      expect(host().querySelector('nala-trends-filter-bar')).toBeNull();
    });

    it('shows the no-family empty state to a user in no family', async () => {
      families = { ok: true, families: [] };
      TestBed.inject(SelectedBabyService).refresh();
      await loadBabies([]);

      expect(host().querySelector('nala-no-family')).not.toBeNull();
      expect(host().querySelector('nala-no-baby')).toBeNull();
      expect(host().querySelector('nala-trends-filter-bar')).toBeNull();
    });

    it('loads the preferences and the babies, and again on the reload signal', async () => {
      expect(loadSections).toHaveBeenCalledTimes(1);
      expect(babiesRequests).toBe(1);

      refresh.reload.set(1);
      await fixture.whenStable();

      expect(loadSections).toHaveBeenCalledTimes(2);
      expect(babiesRequests).toBe(2);
    });

    it('never offers Health and follows the home order, visible then hidden', async () => {
      preferences.set([
        { key: 'diaper', visible: true },
        { key: 'health', visible: true },
        { key: 'sleep', visible: false },
        { key: 'feed', visible: true },
        { key: 'pump', visible: true },
        { key: 'growth', visible: false },
      ]);
      await loadBabies([lea]);
      await click('section-chip');

      expect(all('section-option').map((r) => r.getAttribute('aria-checked'))).toEqual([
        'true',
        'false',
        'false',
        'false',
        'false',
      ]);
      expect(
        [
          ...document.querySelectorAll(
            '.mat-mdc-menu-panel [data-testid="section-option"] mat-icon',
          ),
        ].map((i) => i.textContent?.trim()),
      ).toEqual(['diaper', 'feed', 'pump', 'sleep', 'growth']);
    });

    it('defaults to Feed while the home order is not loaded', async () => {
      await loadBabies([lea]);

      expect(find('section-chip')!.textContent).toContain(en.sections.feed);
    });

    it('defaults to the first visible trends section once the order is loaded', async () => {
      await loadBabies([lea]);
      preferences.set([
        { key: 'feed', visible: false },
        { key: 'sleep', visible: true },
        { key: 'diaper', visible: true },
        { key: 'pump', visible: true },
        { key: 'growth', visible: true },
        { key: 'health', visible: true },
      ]);
      await fixture.whenStable();

      expect(find('section-chip')!.textContent).toContain(en.sections.sleep);
    });

    it('defaults to the first trends section in home order when only Health is visible', async () => {
      preferences.set([
        { key: 'pump', visible: false },
        { key: 'health', visible: true },
        { key: 'feed', visible: false },
        { key: 'sleep', visible: false },
        { key: 'diaper', visible: false },
        { key: 'growth', visible: false },
      ]);
      await loadBabies([lea]);

      expect(find('section-chip')!.textContent).toContain(en.sections.pump);
    });

    it('saves the section and the range picked, and shows the range', async () => {
      await loadBabies([lea]);
      await pick('section-chip', 'section-option', 3);
      await pick('range-chip', 'range-option', 2);

      expect(saved()).toEqual({ section: 'pump', range: '3m' });
      expect(find('section-chip')!.textContent).toContain(en.sections.pump);
      expect(find('range-chip')!.textContent).toContain(en.trends.range['3m']);
      expect(label()).toBe('Jul – Oct 2026');
    });

    it('moves to the previous period and back, › disabled on the current one', async () => {
      await loadBabies([lea]);
      expect(label()).toBe('Oct 3 – 9');
      expect(find('next')!.hasAttribute('disabled')).toBe(true);

      await click('previous');
      expect(label()).toBe('Sep 26 – Oct 2');
      expect(find('next')!.hasAttribute('disabled')).toBe(false);

      await click('next');
      expect(label()).toBe('Oct 3 – 9');
      expect(find('next')!.hasAttribute('disabled')).toBe(true);
    });

    it('disables ‹ once the period reaches the birth date', async () => {
      await loadBabies([lea]);
      await click('previous');
      expect(find('previous')!.hasAttribute('disabled')).toBe(false);

      await click('previous');
      expect(label()).toBe('Sep 19 – 25');
      await click('previous');
      expect(label()).toBe('Sep 12 – 18');
      await click('previous');
      expect(label()).toBe('Sep 5 – 11');
      await click('previous');
      expect(label()).toBe('Aug 29 – Sep 4');
      expect(find('previous')!.hasAttribute('disabled')).toBe(true);
    });

    it('shows Since birth with its dates and no arrows', async () => {
      await loadBabies([lea]);
      await pick('range-chip', 'range-option', 4);

      expect(label()).toBe('Sep – Oct 2026');
      expect(find('previous')).toBeNull();
      expect(find('next')).toBeNull();
    });

    it('goes back to the current period when the section or the range changes', async () => {
      await loadBabies([lea]);
      await click('previous');
      await click('previous');
      await pick('section-chip', 'section-option', 1);
      expect(label()).toBe('Oct 3 – 9');

      await click('previous');
      await pick('range-chip', 'range-option', 1);
      expect(label()).toBe('Sep 10 – Oct 9');
    });
  });

  describe('section content', () => {
    beforeEach(create);

    it("shows Feed's trends by default, for the selected baby and the current period", async () => {
      await loadBabies([lea]);

      const feed = fixture.debugElement.query(By.directive(FeedTrendsComponent))
        .componentInstance as FeedTrendsComponent;
      expect(feed.babyId()).toBe('b1');
      expect(feed.period()).toEqual({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
      expect(feed.today()).toEqual(new Date(2026, 9, 9));
    });

    it("shows Sleep's trends for the selected baby and the current period", async () => {
      await loadBabies([lea]);
      expect(host().querySelector('nala-sleep-trends')).toBeNull();

      await pick('section-chip', 'section-option', 1);

      const sleep = fixture.debugElement.query(By.directive(SleepTrendsComponent))
        .componentInstance as SleepTrendsComponent;
      expect(sleep.babyId()).toBe('b1');
      expect(sleep.period()).toEqual({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
      expect(sleep.today()).toEqual(new Date(2026, 9, 9));
    });

    it.each([
      [2, DiaperTrendsComponent],
      [3, PumpTrendsComponent],
    ] as const)('shows the trends of section option %i', async (option, component) => {
      await loadBabies([lea]);

      await pick('section-chip', 'section-option', option);

      const trends = fixture.debugElement.query(By.directive(component)).componentInstance as
        | DiaperTrendsComponent
        | PumpTrendsComponent;
      expect(trends.babyId()).toBe('b1');
      expect(trends.period()).toEqual({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
    });

    it("shows Growth's trends with the baby's birth date", async () => {
      await loadBabies([lea]);

      await pick('section-chip', 'section-option', 4);

      const growth = fixture.debugElement.query(By.directive(GrowthTrendsComponent))
        .componentInstance as GrowthTrendsComponent;
      expect(growth.babyId()).toBe('b1');
      expect(growth.period()).toEqual({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
      expect(growth.birthDate()).toBe('2026-09-01');
    });
  });

  describe('period', () => {
    beforeEach(create);

    it('moves to the new current period on the reload signal of another day', async () => {
      await loadBabies([lea]);
      await click('previous');

      vi.setSystemTime(new Date(2026, 9, 10, 8));
      refresh.reload.set(1);
      await loadBabies([lea]);

      expect(label()).toBe('Oct 4 – 10');
      expect(find('next')!.hasAttribute('disabled')).toBe(true);
    });

    it('goes back to the current period when another baby is selected', async () => {
      const tom = { id: 'b2', familyId: 'f1', name: 'Tom', birthDate: '2025-01-01' } as Baby;
      await loadBabies([tom, lea]);
      await click('previous');
      await click('previous');

      TestBed.inject(SelectedBabyService).select('b1');
      await fixture.whenStable();

      expect(find('selected-name')?.textContent?.trim()).toBe('Lea');
      expect(label()).toBe('Oct 3 – 9');
    });

    it('gives the dates in the new language when it changes', async () => {
      await loadBabies([lea]);

      TestBed.inject(TranslocoService).setActiveLang('fr');
      await fixture.whenStable();

      expect(label()).toMatch(/^3\s?[–-]\s?9 oct\.$/);
    });
  });

  describe('with remembered filters', () => {
    it('restores them', async () => {
      localStorage.setItem(
        'nala.trendsFilters',
        JSON.stringify({ section: 'growth', range: '6m' }),
      );
      await create();
      await loadBabies([lea]);

      expect(find('section-chip')!.textContent).toContain(en.sections.growth);
      expect(find('range-chip')!.textContent).toContain(en.trends.range['6m']);
    });
  });
});
