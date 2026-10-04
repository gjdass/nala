import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { aPump } from '../../../testing/pumps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { PumpHistoryComponent } from './pump-history.component';

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
/** A session whose left volume (its total) tells it apart. */
const pumpOf = (id: string, leftMl: number) => aPump({ id, leftMl, rightMl: null });

describe('PumpHistoryComponent', () => {
  let fixture: ComponentFixture<PumpHistoryComponent>;
  let pages: Subject<HistoryPage<Pump>>[];
  let pumps: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;

  const host = () => fixture.nativeElement as HTMLElement;
  const totals = () =>
    [...host().querySelectorAll('[data-testid="entry-label"]')].map((e) => e.textContent?.trim());

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
    pages = [];
    pumps = {
      page: vi.fn((): Observable<HistoryPage<Pump>> => {
        const page = new Subject<HistoryPage<Pump>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    await TestBed.configureTestingModule({
      imports: [PumpHistoryComponent, translocoTesting()],
      providers: [
        { provide: PumpService, useValue: pumps },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PumpHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(pumps.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [pumpOf('p2', 20)], next: 'c2' });
    await fixture.whenStable();
    expect(pumps.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [pumpOf('p1', 10)], next: null });
    await fixture.whenStable();
    expect(totals()).toEqual(['20 ml', '10 ml']);
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [pumpOf('p1', 10)], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(pumps.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens a session for editing and puts the saved one back in place', async () => {
    const tapped = pumpOf('p1', 10);
    pages[0].next({ entries: [pumpOf('p2', 20), tapped], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-pump-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('pump', 'pump', tapped);

    edited.next({ saved: pumpOf('p1', 30) });
    await fixture.whenStable();
    expect(totals()).toEqual(['20 ml', '30 ml']);
    expect(pumps.page).toHaveBeenCalledTimes(1);
  });

  it('removes a session deleted from the history', async () => {
    pages[0].next({ entries: [pumpOf('p2', 20), pumpOf('p1', 10)], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-pump-entry button')[0].click();
    edited.next({ deleted: 'p2' });
    await fixture.whenStable();

    expect(totals()).toEqual(['10 ml']);
  });

  it('starts again from the first page once changes kept on the device have been sent', async () => {
    pages[0].next({ entries: [pumpOf('p1', 10)], next: null });
    await fixture.whenStable();

    queue.sent.set(1);
    await fixture.whenStable();

    expect(pumps.page).toHaveBeenCalledTimes(2);
    expect(pumps.page).toHaveBeenLastCalledWith('b1', null);
  });
});
