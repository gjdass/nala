import { ChangeDetectionStrategy, Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby, BabySheetResult } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { DataRefreshService } from '../../core/refresh/data-refresh.service';
import { SECTIONS, SectionDefinition, SectionPreference } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { fakeDataRefresh } from '../../testing/data-refresh';
import { translocoTesting } from '../../testing/transloco-testing';
import { BabySheetComponent } from '../babies/baby-sheet/baby-sheet.component';
import { HomePage } from './home.page';

@Component({
  selector: 'nala-fake-feed-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="card">feed</p>`,
})
class FakeFeedCard {}

@Component({
  selector: 'nala-fake-diaper-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="card">diaper</p>`,
})
class FakeDiaperCard {}

@Component({
  selector: 'nala-fake-sleep-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="card">sleep</p>`,
})
class FakeSleepCard {}

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let preferences: WritableSignal<SectionPreference[] | null>;
  let loadSections: ReturnType<typeof vi.fn>;
  let babiesLoaded: Subject<BabiesResult>;
  let sheetClosed: Subject<BabySheetResult | undefined>;
  let sheet: { open: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const lea: Baby = {
    id: 'b1',
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'girl',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  };
  const tom: Baby = { ...lea, id: 'b0', name: 'Tom', birthDate: '2026-05-18', sex: 'boy' };

  // Diaper and feed are built; sleep is built too but hidden; pump is visible but not built.
  const registered: SectionDefinition[] = [
    {
      key: 'feed',
      icon: 'restaurant',
      loadCard: () => Promise.resolve(FakeFeedCard),
      kinds: [],
      loadHistory: () => Promise.resolve(FakeFeedCard),
    },
    {
      key: 'diaper',
      icon: 'baby_changing_station',
      loadCard: () => Promise.resolve(FakeDiaperCard),
      kinds: [],
      loadHistory: () => Promise.resolve(FakeDiaperCard),
    },
    {
      key: 'sleep',
      icon: 'bedtime',
      loadCard: () => Promise.resolve(FakeSleepCard),
      kinds: [],
      loadHistory: () => Promise.resolve(FakeSleepCard),
    },
  ];
  const saved: SectionPreference[] = [
    { key: 'pump', visible: true },
    { key: 'diaper', visible: true },
    { key: 'sleep', visible: false },
    { key: 'feed', visible: true },
    { key: 'growth', visible: true },
    { key: 'health', visible: true },
  ];
  const cards = () =>
    [...host().querySelectorAll('[data-testid="section-column"] [data-testid="card"]')].map((c) =>
      c.textContent?.trim(),
    );

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();
  const load = async (result: BabiesResult) => {
    babiesLoaded.next(result);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    preferences = signal<SectionPreference[] | null>(null);
    loadSections = vi.fn();
    babiesLoaded = new Subject<BabiesResult>();
    sheetClosed = new Subject<BabySheetResult | undefined>();
    sheet = { open: vi.fn(() => sheetClosed) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HomePage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: SECTIONS, useValue: registered },
        {
          provide: SectionPreferencesService,
          useValue: { preferences, load: loadSections, save: vi.fn() },
        },
        { provide: BabyService, useValue: { list: () => babiesLoaded } },
        { provide: SheetService, useValue: sheet },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
  });

  it('reloads the babies and the section preferences on the reload signal', async () => {
    const list = vi.spyOn(TestBed.inject(BabyService), 'list');
    loadSections.mockClear();

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(1);
    expect(loadSections).toHaveBeenCalledTimes(1);
  });

  it('shows the top bar, whatever the babies', () => {
    expect(host().querySelector('nala-top-app-bar')).not.toBeNull();
  });

  it('shows neither the empty state nor the app content while the babies load', () => {
    expect(find('empty-state')).toBeNull();
    expect(find('section-column')).toBeNull();
  });

  describe('without any baby', () => {
    beforeEach(() => load({ ok: true, babies: [] }));

    it('shows only the empty state inviting to add a baby, no section card', async () => {
      preferences.set(saved);
      await fixture.whenStable();

      expect(text('empty-title')).toBe(en.babies.empty.title);
      expect(text('empty-text')).toBe(en.babies.empty.text);
      expect(text('add-baby')).toBe(en.babies.empty.add);
      expect(find('section-column')).toBeNull();
    });

    it('opens the baby sheet from the empty state', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(sheet.open).toHaveBeenCalledWith(BabySheetComponent);
    });

    it('leaves the empty state once a baby is added', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      sheetClosed.next({ saved: lea });
      await fixture.whenStable();

      expect(find('empty-state')).toBeNull();
      expect(find('section-column')).toBeTruthy();
      expect(text('selected-name')).toBe('Lea');
    });

    it('stays on the empty state when the sheet is closed without saving', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      sheetClosed.next(undefined);
      await fixture.whenStable();

      expect(find('empty-state')).toBeTruthy();
    });
  });

  describe('with a baby', () => {
    beforeEach(() => load({ ok: true, babies: [lea] }));

    it('shows the app content, no empty state', () => {
      expect(find('empty-state')).toBeNull();
      expect(find('section-column')).toBeTruthy();
    });

    it('loads the section preferences', () => {
      expect(loadSections).toHaveBeenCalled();
    });

    it('shows no card until the section preferences are loaded', () => {
      expect(cards()).toEqual([]);
    });

    it('shows one card per visible built section, in the user order', async () => {
      preferences.set(saved);
      await fixture.whenStable();

      expect(cards()).toEqual(['diaper', 'feed']);
    });

    it('follows a change of the preferences', async () => {
      preferences.set(saved);
      await fixture.whenStable();
      preferences.set([...saved].reverse());
      await fixture.whenStable();

      expect(cards()).toEqual(['feed', 'diaper']);
    });

    it('shows the selected baby in the top bar, without a switcher', () => {
      expect(text('selected-name')).toBe('Lea');
      expect(find('baby-switcher')).toBeNull();
    });
  });

  describe('with several babies', () => {
    it('selects the first baby when none is stored', async () => {
      await load({ ok: true, babies: [tom, lea] });

      expect(text('selected-name')).toBe('Tom');
      expect(find('baby-switcher')).toBeTruthy();
    });

    it('restores the selected baby from nala.baby', async () => {
      localStorage.setItem('nala.baby', lea.id);
      await load({ ok: true, babies: [tom, lea] });

      expect(text('selected-name')).toBe('Lea');
    });

    it('switching baby from the bar updates the bar and stores the choice', async () => {
      await load({ ok: true, babies: [tom, lea] });

      (find('baby-switcher') as HTMLButtonElement).click();
      await fixture.whenStable();
      const items = document.querySelectorAll<HTMLButtonElement>('[data-testid="switcher-item"]');
      items[1].click();
      await fixture.whenStable();

      expect(text('selected-name')).toBe('Lea');
      expect(localStorage.getItem('nala.baby')).toBe(lea.id);
    });
  });

  it('says when the babies cannot be loaded', async () => {
    await load({ ok: false, errors: { form: 'unknown' } });

    expect(text('babies-error')).toBe(en.babies.loadError);
    expect(find('empty-state')).toBeNull();
    expect(find('section-column')).toBeNull();
  });
});
