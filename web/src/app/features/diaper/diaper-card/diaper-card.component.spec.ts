import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Diaper } from '../../../core/diapers/diaper.models';
import { DiaperService } from '../../../core/diapers/diaper.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aDiaper } from '../../../testing/diapers';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DiaperCardComponent } from './diaper-card.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string) => ({ id, name: id }) as Baby;
const diaper = (id: string, ago: number, overrides: Partial<Diaper> = {}) =>
  aDiaper({ id, time: minutesAgo(ago), ...overrides });

describe('DiaperCardComponent', () => {
  let fixture: ComponentFixture<DiaperCardComponent>;
  let pages: Subject<HistoryPage<Diaper>>[];
  let diapers: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: Diaper[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    diapers = {
      page: vi.fn((): Observable<HistoryPage<Diaper>> => {
        const page = new Subject<HistoryPage<Diaper>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aDiaper() })), edit: vi.fn(() => edited) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [DiaperCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: DiaperService, useValue: diapers },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DiaperCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the diaper section', () => {
    expect(text('section-title')).toBe(en.sections.diaper);
  });

  it('loads the diapers of the selected baby page by page', () => {
    expect(diapers.page).toHaveBeenCalledWith('b1', null);
  });

  it('shows the empty state without any diaper', async () => {
    await respond([]);

    expect(text('empty-title')).toBe(en.diaper.card.empty.title);
    expect(find('diaper-highlight')).toBeNull();
  });

  it('highlights the time since the most recent change, live', async () => {
    await respond([diaper('d2', 26.5), diaper('d1', 200)]);

    expect(text('diaper-last-label')).toBe(en.diaper.card.lastChange);
    expect(text('diaper-since')).toBe('26m');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('diaper-since')).toBe('27m');
  });

  it('takes the latest time among the loaded diapers', async () => {
    await respond([diaper('d1', 200), diaper('d2', 80)]);

    expect(text('diaper-since')).toBe('1h 20m');
  });

  it('shows the time since in hours and minutes only, <1m under a minute', async () => {
    await respond([diaper('d1', 0.5)]);

    expect(text('diaper-since')).toBe('<1m');
  });

  it('caps the time since at >24h', async () => {
    await respond([diaper('d1', 25 * 60)]);

    expect(text('diaper-since')).toBe('>24h');
  });

  it("shows that diaper's type on the right", async () => {
    await respond([diaper('d2', 30, { wet: true, dirty: true }), diaper('d1', 200)]);

    expect(text('diaper-last-type')).toBe('Wet + dirty');
    const since = find('diaper-since')!;
    expect(
      since.compareDocumentPosition(find('diaper-last-type')!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows "Dry" for a diaper with neither toggle', async () => {
    await respond([diaper('d1', 30, { wet: false, dirty: false })]);

    expect(text('diaper-last-type')).toBe('Dry');
  });

  it('marks a rash under the type when that diaper had one', async () => {
    await respond([diaper('d2', 10, { rash: true }), diaper('d1', 30)]);

    expect(text('diaper-last-rash')).toBe(en.diaper.card.rash);
  });

  it('shows no rash mark when the last diaper had none, even if an older one had', async () => {
    await respond([diaper('d2', 10), diaper('d1', 30, { rash: true })]);

    expect(find('diaper-last-rash')).toBeNull();
  });

  it('lists the recent diapers as entry items', async () => {
    await respond([diaper('d2', 30, { dirty: true, wet: false }), diaper('d1', 200)]);

    const labels = [...host().querySelectorAll('[data-testid="entry-label"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['Dirty', 'Wet']);
  });

  it('opens a tapped diaper in the Diaper sheet, then reloads', async () => {
    const tapped = diaper('d1', 30);
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-diaper-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('diaper', 'diaper', tapped);
    expect(diapers.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: tapped });
    edited.complete();
    await fixture.whenStable();
    expect(diapers.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([diaper('d1', 30)]);

    host().querySelector<HTMLButtonElement>('nala-diaper-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(diapers.page).toHaveBeenCalledTimes(1);
  });

  it('opens the Diaper sheet directly on +, then reloads', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('diaper');
    expect(diapers.page).toHaveBeenCalledTimes(2);
  });

  it('reloads on the reload signal, keeping the diapers shown until the new ones arrive', async () => {
    await respond([diaper('d1', 30)]);

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(diapers.page).toHaveBeenCalledTimes(2);
    expect(text('diaper-since')).toBe('30m');
    await respond([diaper('d2', 10), diaper('d1', 30)]);
    expect(text('diaper-since')).toBe('10m');
  });

  it('reloads for the baby switched to', async () => {
    await respond([diaper('d1', 30)]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(diapers.page).toHaveBeenLastCalledWith('b2', null);
  });
});
