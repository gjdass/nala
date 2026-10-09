import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { aSleep } from '../../../testing/sleeps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SleepHistoryComponent } from './sleep-history.component';

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
/** A sleep of `hours`, so each one is told apart by its summary. */
const sleepOf = (id: string, hours: number) =>
  aSleep({
    id,
    startTime: '2026-09-30T08:00:00Z',
    endTime: new Date(Date.parse('2026-09-30T08:00:00Z') + hours * 3_600_000).toISOString(),
  });

describe('SleepHistoryComponent', () => {
  let fixture: ComponentFixture<SleepHistoryComponent>;
  let pages: Subject<HistoryPage<Sleep>>[];
  let sleeps: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const durations = () =>
    [...host().querySelectorAll('[data-testid="entry-summary"]')].map(
      (e) => e.textContent?.trim().split(' · ')[0],
    );

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
    pages = [];
    sleeps = {
      page: vi.fn((): Observable<HistoryPage<Sleep>> => {
        const page = new Subject<HistoryPage<Sleep>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { edit: vi.fn(() => edited) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [SleepHistoryComponent, translocoTesting()],
      providers: [
        { provide: SleepService, useValue: sleeps },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SleepHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(sleeps.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [sleepOf('s2', 2)], next: 'c2' });
    await fixture.whenStable();
    expect(sleeps.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [sleepOf('s1', 1)], next: null });
    await fixture.whenStable();
    expect(durations()).toEqual(['2h', '1h']);
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [sleepOf('s1', 1)], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(sleeps.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens a sleep for editing and puts the saved one back in place', async () => {
    const tapped = sleepOf('s1', 1);
    pages[0].next({ entries: [sleepOf('s2', 2), tapped], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-sleep-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('sleep', 'sleep', tapped);

    edited.next({ saved: sleepOf('s1', 3) });
    await fixture.whenStable();
    expect(durations()).toEqual(['2h', '3h']);
    expect(sleeps.page).toHaveBeenCalledTimes(1);
  });

  it('removes a sleep deleted from the history', async () => {
    pages[0].next({ entries: [sleepOf('s2', 2), sleepOf('s1', 1)], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-sleep-entry button')[0].click();
    edited.next({ deleted: 's2' });
    await fixture.whenStable();

    expect(durations()).toEqual(['1h']);
  });

  it('starts again from the first page on the reload signal', async () => {
    pages[0].next({ entries: [sleepOf('s1', 1)], next: null });
    await fixture.whenStable();

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(sleeps.page).toHaveBeenCalledTimes(2);
    expect(sleeps.page).toHaveBeenLastCalledWith('b1', null);
  });
});
