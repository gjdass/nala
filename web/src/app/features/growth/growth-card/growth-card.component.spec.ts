import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { GrowthEntry, GrowthLatest } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aGrowthEntry, aMilestone } from '../../../testing/growth-entries';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { GrowthCardComponent } from './growth-card.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const baby = (id: string) => ({ id, name: id, birthDate: '2026-08-15' }) as Baby;
const none: GrowthLatest = { weight: null, length: null, headCircumference: null };

describe('GrowthCardComponent', () => {
  let fixture: ComponentFixture<GrowthCardComponent>;
  let pages: Subject<HistoryPage<GrowthEntry>>[];
  let latests: Subject<GrowthLatest | null>[];
  let growthEntries: { page: ReturnType<typeof vi.fn>; latest: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: GrowthEntry[], latest: GrowthLatest | null = none) => {
    pages.at(-1)!.next({ entries, next: null });
    latests.at(-1)!.next(latest);
    await fixture.whenStable();
  };
  const summaries = () =>
    [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) =>
      e.textContent?.replace(/\s+/g, ' ').trim(),
    );

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    latests = [];
    growthEntries = {
      page: vi.fn((): Observable<HistoryPage<GrowthEntry>> => {
        const page = new Subject<HistoryPage<GrowthEntry>>();
        pages.push(page);
        return page;
      }),
      latest: vi.fn((): Observable<GrowthLatest | null> => {
        const latest = new Subject<GrowthLatest | null>();
        latests.push(latest);
        return latest;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aGrowthEntry() })), edit: vi.fn(() => edited) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [GrowthCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: GrowthEntryService, useValue: growthEntries },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GrowthCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the growth section', () => {
    expect(text('section-title')).toBe(en.sections.growth);
  });

  it('loads the entries page by page and the latest values of the selected baby', () => {
    expect(growthEntries.page).toHaveBeenCalledWith('b1', null);
    expect(growthEntries.latest).toHaveBeenCalledWith('b1');
  });

  it('shows neither the highlight nor the empty state until both have loaded', async () => {
    pages.at(-1)!.next({ entries: [], next: null });
    await fixture.whenStable();

    expect(find('growth-highlight')).toBeNull();
    expect(find('empty-title')).toBeNull();
  });

  it('highlights weight, length and head side by side, each with its label and date', async () => {
    await respond([aGrowthEntry()], {
      weight: { value: 4250, date: '2026-10-03', birth: false },
      length: { value: 55.5, date: '2026-10-02', birth: false },
      headCircumference: { value: 38, date: '2026-09-28', birth: false },
    });

    expect(en.growth.card.weight).toBe('Weight');
    expect(en.growth.card.length).toBe('Length');
    expect(en.growth.card.head).toBe('Head');
    expect(text('growth-weight-label')).toBe('Weight');
    expect(text('growth-weight-value')).toBe('4.250 kg');
    expect(text('growth-weight-date')).toBe('Today');
    expect(text('growth-length-label')).toBe('Length');
    expect(text('growth-length-value')).toBe('55.5 cm');
    expect(text('growth-length-date')).toBe('Yesterday');
    expect(text('growth-head-label')).toBe('Head');
    expect(text('growth-head-value')).toBe('38.0 cm');
    expect(text('growth-head-date')).toBe('Sep 28');
    const weight = find('growth-weight-value')!;
    expect(
      weight.compareDocumentPosition(find('growth-length-value')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says "Birth" for a value from the birth profile, and "—" for a measure without value', async () => {
    await respond([], {
      weight: { value: 3200, date: '2026-08-15', birth: true },
      length: null,
      headCircumference: { value: 36, date: '2026-09-28', birth: false },
    });

    expect(en.growth.card.birth).toBe('Birth');
    expect(text('growth-weight-value')).toBe('3.200 kg');
    expect(text('growth-weight-date')).toBe('Birth');
    expect(text('growth-length-value')).toBe('—');
    expect(find('growth-length-date')?.textContent?.trim() ?? '').toBe('');
    expect(find('empty-title')).toBeNull();
  });

  it('shows the empty state with no measurement and no birth measurement, even with other entries', async () => {
    await respond([aGrowthEntry({ weightG: null, lengthCm: null, headCircumferenceCm: 37 })], none);

    expect(text('empty-title')).toBe(en.growth.card.empty.title);
    expect(find('growth-highlight')).toBeNull();
    expect(summaries()).toHaveLength(1);
  });

  it('lists the recent entries, an entry date counting as its local midnight for the last 24 hours', async () => {
    await respond(
      [
        aGrowthEntry({ id: 'g5', date: '2026-10-03', weightG: 4500 }),
        aGrowthEntry({ id: 'g4', date: '2026-10-03', weightG: 4400 }),
        aGrowthEntry({ id: 'g3', date: '2026-10-03', weightG: 4300 }),
        aGrowthEntry({ id: 'g2', date: '2026-10-03', weightG: 4200 }),
        aGrowthEntry({ id: 'g1', date: '2026-10-02', weightG: 4100 }),
      ],
      {
        ...none,
        weight: { value: 4500, date: '2026-10-03', birth: false },
      },
    );

    expect(summaries()).toHaveLength(3);
    find('section-toggle')!.click();
    await fixture.whenStable();
    expect(summaries().map((s) => s?.split(' · ')[0])).toEqual([
      '4.500 kg',
      '4.400 kg',
      '4.300 kg',
      '4.200 kg',
    ]);
  });

  it('shows the entries without a highlight when the latest values cannot be loaded', async () => {
    await respond([aGrowthEntry()], null);

    expect(find('growth-weight-value')).toBeNull();
    expect(find('empty-title')).toBeNull();
    expect(summaries()).toHaveLength(1);
  });

  it('opens a tapped entry in the Measurement sheet, then reloads the entries and the highlight', async () => {
    const tapped = aGrowthEntry();
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-growth-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('growth', 'measurement', tapped);

    edited.next({ deleted: tapped.id });
    edited.complete();
    await fixture.whenStable();
    expect(growthEntries.page).toHaveBeenCalledTimes(2);
    expect(growthEntries.latest).toHaveBeenCalledTimes(2);
  });

  it('opens a tapped milestone in the Milestone sheet', async () => {
    const tapped = aMilestone();
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-growth-entry button')!.click();

    expect(entrySheets.edit).toHaveBeenCalledWith('growth', 'milestone', tapped);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([aGrowthEntry()]);

    host().querySelector<HTMLButtonElement>('nala-growth-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(growthEntries.page).toHaveBeenCalledTimes(1);
    expect(growthEntries.latest).toHaveBeenCalledTimes(1);
  });

  it('adds an entry on + (the kind picker comes from the section), then reloads the entries and the highlight', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('growth');
    expect(growthEntries.page).toHaveBeenCalledTimes(2);
    expect(growthEntries.latest).toHaveBeenCalledTimes(2);
  });

  it('reloads on the reload signal', async () => {
    await respond([]);
    const shown = host().textContent;

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(growthEntries.page).toHaveBeenCalledTimes(2);
    expect(growthEntries.latest).toHaveBeenCalledTimes(2);
    expect(host().textContent).toBe(shown);
  });

  it('reloads for the baby switched to', async () => {
    await respond([aGrowthEntry()]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(growthEntries.page).toHaveBeenLastCalledWith('b2', null);
    expect(growthEntries.latest).toHaveBeenLastCalledWith('b2');
  });
});
