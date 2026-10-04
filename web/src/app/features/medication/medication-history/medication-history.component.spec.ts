import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { Medication } from '../../../core/medications/medication.models';
import { MedicationService } from '../../../core/medications/medication.service';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { aMedication } from '../../../testing/medications';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MedicationHistoryComponent } from './medication-history.component';

/** Reports every observed element as visible straight away, like a short list. */
class VisibleIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  disconnect(): void {
    // Nothing is kept.
  }
}

const baby = (id: string) => ({ id, name: id }) as Baby;
/** A dose without an amount, whose notes tell it apart. */
const medicationOf = (id: string, notes: string) =>
  aMedication({ id, notes, amount: null, unit: null });

describe('MedicationHistoryComponent', () => {
  let fixture: ComponentFixture<MedicationHistoryComponent>;
  let pages: Subject<HistoryPage<Medication>>[];
  let medications: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;

  const host = () => fixture.nativeElement as HTMLElement;
  const notes = () =>
    [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) => e.textContent?.trim());

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
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
    entrySheets = { edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    await TestBed.configureTestingModule({
      imports: [MedicationHistoryComponent, translocoTesting()],
      providers: [
        { provide: MedicationService, useValue: medications },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MedicationHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(medications.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [medicationOf('d2', '2h')], next: 'c2' });
    await fixture.whenStable();
    expect(medications.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [medicationOf('d1', '1h')], next: null });
    await fixture.whenStable();
    expect(notes()).toEqual(['2h', '1h']);
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [medicationOf('d1', '1h')], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(medications.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens a medication for editing and puts the saved one back in place', async () => {
    const tapped = medicationOf('d1', '1h');
    pages[0].next({ entries: [medicationOf('d2', '2h'), tapped], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-medication-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('medication', 'medication', tapped);

    edited.next({ saved: medicationOf('d1', '3h') });
    await fixture.whenStable();
    expect(notes()).toEqual(['2h', '3h']);
    expect(medications.page).toHaveBeenCalledTimes(1);
  });

  it('removes a medication deleted from the history', async () => {
    pages[0].next({ entries: [medicationOf('d2', '2h'), medicationOf('d1', '1h')], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-medication-entry button')[0].click();
    edited.next({ deleted: 'd2' });
    await fixture.whenStable();

    expect(notes()).toEqual(['1h']);
  });

  it('starts again from the first page once changes kept on the device have been sent', async () => {
    pages[0].next({ entries: [medicationOf('d1', '1h')], next: null });
    await fixture.whenStable();

    queue.sent.set(1);
    await fixture.whenStable();

    expect(medications.page).toHaveBeenCalledTimes(2);
    expect(medications.page).toHaveBeenLastCalledWith('b1', null);
  });
});
