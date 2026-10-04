import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Medication } from '../../../core/medications/medication.models';
import { MedicationService } from '../../../core/medications/medication.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aMedication } from '../../../testing/medications';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MedicationCardComponent } from './medication-card.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string) => ({ id, name: id }) as Baby;
const medication = (id: string, ago: number, overrides: Partial<Medication> = {}) =>
  aMedication({ id, time: minutesAgo(ago), ...overrides });

describe('MedicationCardComponent', () => {
  let fixture: ComponentFixture<MedicationCardComponent>;
  let pages: Subject<HistoryPage<Medication>>[];
  let medications: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: Medication[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    medications = {
      page: vi.fn((): Observable<HistoryPage<Medication>> => {
        const page = new Subject<HistoryPage<Medication>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aMedication() })), edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    await TestBed.configureTestingModule({
      imports: [MedicationCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: MedicationService, useValue: medications },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MedicationCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the medication section', () => {
    expect(text('section-title')).toBe(en.sections.medication);
  });

  it('loads the doses of the selected baby page by page', () => {
    expect(medications.page).toHaveBeenCalledWith('b1', null);
  });

  it('shows the empty state without any dose', async () => {
    await respond([]);

    expect(text('empty-title')).toBe(en.medication.card.empty.title);
    expect(find('medication-highlight')).toBeNull();
  });

  it('highlights the time since the most recent dose, live', async () => {
    await respond([medication('m2', 26.5), medication('m1', 200)]);

    expect(text('medication-last-label')).toBe(en.medication.card.lastDose);
    expect(text('medication-since')).toBe('26m');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('medication-since')).toBe('27m');
  });

  it('takes the latest time among the loaded doses', async () => {
    await respond([medication('m1', 200), medication('m2', 80)]);

    expect(text('medication-since')).toBe('1h 20m');
  });

  it('shows the time since in hours and minutes only, <1m under a minute', async () => {
    await respond([medication('m1', 0.5)]);

    expect(text('medication-since')).toBe('<1m');
  });

  it('caps the time since at >24h', async () => {
    await respond([medication('m1', 25 * 60)]);

    expect(text('medication-since')).toBe('>24h');
  });

  it("shows that dose's name on the right, with its dose under it", async () => {
    await respond([
      medication('m2', 30, { name: 'Vitamin D', amount: 1, unit: 'drops' }),
      medication('m1', 200),
    ]);

    expect(text('medication-last-name')).toBe('Vitamin D');
    expect(text('medication-last-dose')).toBe('1 drop');
    const since = find('medication-since')!;
    expect(
      since.compareDocumentPosition(find('medication-last-name')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no dose under the name when the last dose had no amount', async () => {
    await respond([
      medication('m2', 10, { amount: null, unit: null }),
      medication('m1', 30, { amount: 5, unit: 'ml' }),
    ]);

    expect(text('medication-last-name')).toBe('Paracetamol');
    expect(find('medication-last-dose')).toBeNull();
  });

  it('lists the recent doses as entry items', async () => {
    await respond([medication('m2', 30, { name: 'Ibuprofen' }), medication('m1', 200)]);

    const labels = [...host().querySelectorAll('[data-testid="entry-label"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['Ibuprofen', 'Paracetamol']);
  });

  it('opens a tapped dose in the Medication sheet, then reloads', async () => {
    const tapped = medication('m1', 30);
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-medication-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('medication', 'medication', tapped);
    expect(medications.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: tapped });
    edited.complete();
    await fixture.whenStable();
    expect(medications.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([medication('m1', 30)]);

    host().querySelector<HTMLButtonElement>('nala-medication-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(medications.page).toHaveBeenCalledTimes(1);
  });

  it('opens the Medication sheet directly on +, then reloads', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('medication');
    expect(medications.page).toHaveBeenCalledTimes(2);
  });

  it('reloads once changes kept on the device have been sent', async () => {
    await respond([]);

    queue.sent.set(1);
    await fixture.whenStable();

    expect(medications.page).toHaveBeenCalledTimes(2);
  });

  it('reloads for the baby switched to', async () => {
    await respond([medication('m1', 30)]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(medications.page).toHaveBeenLastCalledWith('b2', null);
  });
});
