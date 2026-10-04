import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { aHealthEntry } from '../../../testing/health-entries';
import { translocoTesting } from '../../../testing/transloco-testing';
import { HealthHistoryComponent } from './health-history.component';

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
const healthEntryOf = (id: string, notes: string) =>
  aHealthEntry({ id, notes, amount: null, unit: null });

describe('HealthHistoryComponent', () => {
  let fixture: ComponentFixture<HealthHistoryComponent>;
  let pages: Subject<HistoryPage<HealthEntry>>[];
  let healthEntries: { page: ReturnType<typeof vi.fn> };
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
    healthEntries = {
      page: vi.fn((): Observable<HistoryPage<HealthEntry>> => {
        const page = new Subject<HistoryPage<HealthEntry>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    await TestBed.configureTestingModule({
      imports: [HealthHistoryComponent, translocoTesting()],
      providers: [
        { provide: HealthEntryService, useValue: healthEntries },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HealthHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(healthEntries.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [healthEntryOf('d2', '2h')], next: 'c2' });
    await fixture.whenStable();
    expect(healthEntries.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [healthEntryOf('d1', '1h')], next: null });
    await fixture.whenStable();
    expect(notes()).toEqual(['2h', '1h']);
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [healthEntryOf('d1', '1h')], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(healthEntries.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens a health entry for editing and puts the saved one back in place', async () => {
    const tapped = healthEntryOf('d1', '1h');
    pages[0].next({ entries: [healthEntryOf('d2', '2h'), tapped], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-health-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('health', 'health', tapped);

    edited.next({ saved: healthEntryOf('d1', '3h') });
    await fixture.whenStable();
    expect(notes()).toEqual(['2h', '3h']);
    expect(healthEntries.page).toHaveBeenCalledTimes(1);
  });

  it('removes a health entry deleted from the history', async () => {
    pages[0].next({ entries: [healthEntryOf('d2', '2h'), healthEntryOf('d1', '1h')], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-health-entry button')[0].click();
    edited.next({ deleted: 'd2' });
    await fixture.whenStable();

    expect(notes()).toEqual(['1h']);
  });

  it('starts again from the first page once changes kept on the device have been sent', async () => {
    pages[0].next({ entries: [healthEntryOf('d1', '1h')], next: null });
    await fixture.whenStable();

    queue.sent.set(1);
    await fixture.whenStable();

    expect(healthEntries.page).toHaveBeenCalledTimes(2);
    expect(healthEntries.page).toHaveBeenLastCalledWith('b1', null);
  });
});
