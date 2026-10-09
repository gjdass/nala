import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aHealthEntry } from '../../../testing/health-entries';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { HealthCardComponent } from './health-card.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string) => ({ id, name: id }) as Baby;
const healthEntry = (id: string, ago: number, overrides: Partial<HealthEntry> = {}) =>
  aHealthEntry({ id, time: minutesAgo(ago), ...overrides });

describe('HealthCardComponent', () => {
  let fixture: ComponentFixture<HealthCardComponent>;
  let pages: Subject<HistoryPage<HealthEntry>>[];
  let healthEntries: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: HealthEntry[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    healthEntries = {
      page: vi.fn((): Observable<HistoryPage<HealthEntry>> => {
        const page = new Subject<HistoryPage<HealthEntry>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aHealthEntry() })), edit: vi.fn(() => edited) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HealthCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: HealthEntryService, useValue: healthEntries },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HealthCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the health entry section', () => {
    expect(text('section-title')).toBe(en.sections.health);
  });

  it('loads the doses of the selected baby page by page', () => {
    expect(healthEntries.page).toHaveBeenCalledWith('b1', null);
  });

  it('shows the empty state without any entry', async () => {
    await respond([]);

    expect(en.health.card.empty.title).toBe('No entry logged yet');
    expect(text('empty-title')).toBe(en.health.card.empty.title);
    expect(find('health-highlight')).toBeNull();
  });

  it('highlights the time since the most recent dose, live', async () => {
    await respond([healthEntry('m2', 26.5), healthEntry('m1', 200)]);

    expect(text('health-last-label')).toBe(en.health.card.lastEntry);
    expect(text('health-since')).toBe('26m');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('health-since')).toBe('27m');
  });

  it('takes the latest time among the loaded doses', async () => {
    await respond([healthEntry('m1', 200), healthEntry('m2', 80)]);

    expect(text('health-since')).toBe('1h 20m');
  });

  it('shows the time since in hours and minutes only, <1m under a minute', async () => {
    await respond([healthEntry('m1', 0.5)]);

    expect(text('health-since')).toBe('<1m');
  });

  it('caps the time since at >24h', async () => {
    await respond([healthEntry('m1', 25 * 60)]);

    expect(text('health-since')).toBe('>24h');
  });

  it("shows that dose's name on the right, with its dose under it", async () => {
    await respond([
      healthEntry('m2', 30, { name: 'Vitamin D', amount: 1, unit: 'drops' }),
      healthEntry('m1', 200),
    ]);

    expect(text('health-last-value')).toBe('Vitamin D');
    expect(text('health-last-detail')).toBe('1 drop');
    const since = find('health-since')!;
    expect(
      since.compareDocumentPosition(find('health-last-value')!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no dose under the name when the last dose had no amount', async () => {
    await respond([
      healthEntry('m2', 10, { amount: null, unit: null }),
      healthEntry('m1', 30, { amount: 5, unit: 'ml' }),
    ]);

    expect(text('health-last-value')).toBe('Paracetamol');
    expect(find('health-last-detail')).toBeNull();
  });

  // `text()` folds the no-break space before °C; the pipe's own spec checks it.
  it('highlights the last entry, with its dose and temperature under the name', async () => {
    await respond([healthEntry('m2', 10, { temperature: 38.5 })]);

    expect(en.health.card.lastEntry).toBe('Last entry');
    expect(text('health-last-value')).toBe('Paracetamol');
    expect(text('health-last-detail')).toBe('2.5 ml · 38.5 °C');
  });

  it('shows the temperature alone under a name without a dose', async () => {
    await respond([healthEntry('m2', 10, { amount: null, unit: null, temperature: 38.5 })]);

    expect(text('health-last-detail')).toBe('38.5 °C');
  });

  it('shows the temperature on the right, with nothing under it, for an entry without a name', async () => {
    await respond([
      healthEntry('m2', 10, { name: null, amount: null, unit: null, temperature: 38.5 }),
    ]);

    expect(text('health-last-value')).toBe('38.5 °C');
    expect(find('health-last-detail')).toBeNull();
  });

  it('lists the recent doses as entry items', async () => {
    await respond([healthEntry('m2', 30, { name: 'Ibuprofen' }), healthEntry('m1', 200)]);

    const labels = [...host().querySelectorAll('[data-testid="entry-label"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['Ibuprofen', 'Paracetamol']);
  });

  it('opens a tapped dose in the Health sheet, then reloads', async () => {
    const tapped = healthEntry('m1', 30);
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-health-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('health', 'health', tapped);
    expect(healthEntries.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: tapped });
    edited.complete();
    await fixture.whenStable();
    expect(healthEntries.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([healthEntry('m1', 30)]);

    host().querySelector<HTMLButtonElement>('nala-health-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(healthEntries.page).toHaveBeenCalledTimes(1);
  });

  it('opens the Health sheet directly on +, then reloads', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('health');
    expect(healthEntries.page).toHaveBeenCalledTimes(2);
  });

  it('reloads on the reload signal', async () => {
    await respond([]);
    const shown = host().textContent;

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(healthEntries.page).toHaveBeenCalledTimes(2);
    expect(host().textContent).toBe(shown);
  });

  it('reloads for the baby switched to', async () => {
    await respond([healthEntry('m1', 30)]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(healthEntries.page).toHaveBeenLastCalledWith('b2', null);
  });
});
