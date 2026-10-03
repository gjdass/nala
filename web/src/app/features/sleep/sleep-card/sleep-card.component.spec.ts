import { inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { RUNNING_TIMER_SOURCES } from '../../../core/timers/running-timer.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { fakeSleepSync } from '../../../testing/sleep-sync';
import { aSleep } from '../../../testing/sleeps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SleepTimerSource } from '../sleep-timers';
import { SleepCardComponent } from './sleep-card.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string) => ({ id, name: id }) as Baby;
/** A sleep from `startMinutesAgo` to `endMinutesAgo`. */
const sleep = (id: string, startMinutesAgo: number, endMinutesAgo: number) =>
  aSleep({ id, startTime: minutesAgo(startMinutesAgo), endTime: minutesAgo(endMinutesAgo) });

describe('SleepCardComponent', () => {
  let fixture: ComponentFixture<SleepCardComponent>;
  let pages: Subject<HistoryPage<Sleep>>[];
  let sleeps: { page: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  let sync: ReturnType<typeof fakeSleepSync>;
  let stopped: Subject<unknown>;
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: Sleep[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    sleeps = {
      page: vi.fn((): Observable<HistoryPage<Sleep>> => {
        const page = new Subject<HistoryPage<Sleep>>();
        pages.push(page);
        return page;
      }),
      stop: vi.fn(() => stopped),
    };
    stopped = new Subject();
    sync = fakeSleepSync();
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aSleep() })), edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    await TestBed.configureTestingModule({
      imports: [SleepCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: SleepService, useValue: sleeps },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
        { provide: SleepSyncService, useValue: sync },
        { provide: RUNNING_TIMER_SOURCES, useFactory: () => [inject(SleepTimerSource)] },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SleepCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the sleep section', () => {
    expect(text('section-title')).toBe(en.sections.sleep);
  });

  it('loads the sleeps of the selected baby page by page', () => {
    expect(sleeps.page).toHaveBeenCalledWith('b1', null);
  });

  it('shows the empty state without any sleep', async () => {
    await respond([]);

    expect(text('empty-title')).toBe(en.sleep.card.empty.title);
    expect(find('sleep-highlight')).toBeNull();
  });

  it('highlights how long the baby has been awake since the latest sleep ended, live', async () => {
    await respond([sleep('s2', 90, 26.5), sleep('s1', 300, 200)]);

    expect(text('sleep-awake-label')).toBe(en.sleep.card.awakeFor);
    expect(text('sleep-awake-for')).toBe('26m 30s');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('sleep-awake-for')).toBe('27m 30s');
  });

  it('shows the duration of that sleep on the right, labelled last sleep', async () => {
    await respond([sleep('s2', 170, 80), sleep('s1', 300, 200)]);

    expect(text('sleep-awake-for')).toBe('1h 20m');
    expect(text('sleep-last-duration')).toBe('1h 30m');
    expect(text('sleep-last-duration-label')).toBe(en.sleep.card.lastSleep);
    const awake = find('sleep-awake-for')!;
    expect(
      awake.compareDocumentPosition(find('sleep-last-duration')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('takes the sleep that ended last, even if another one started later', async () => {
    await respond([sleep('s2', 100, 90), sleep('s1', 300, 30)]);

    expect(text('sleep-awake-for')).toBe('30m');
    expect(text('sleep-last-duration')).toBe('4h 30m');
  });

  it('lists the recent sleeps as entry items', async () => {
    await respond([sleep('s2', 170, 80), sleep('s1', 300, 200)]);

    const summaries = [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatch(/^1h 30m · until /);
  });

  it('lists a live sleep, and counts the time awake from the latest stopped one', async () => {
    const live = aSleep({ id: 's3', startTime: minutesAgo(20), endTime: null });
    await respond([live, sleep('s2', 170, 80)]);

    const summaries = [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(summaries[0]).toBe('Sleeping · 20m');
    expect(text('sleep-awake-for')).toBe('1h 20m');
    expect(text('sleep-last-duration')).toBe('1h 30m');
  });

  it('opens a tapped sleep in the Sleep sheet, then reloads', async () => {
    const tapped = sleep('s1', 170, 80);
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-sleep-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('sleep', 'sleep', tapped);
    expect(sleeps.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: tapped });
    edited.complete();
    await fixture.whenStable();
    expect(sleeps.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([sleep('s1', 170, 80)]);

    host().querySelector<HTMLButtonElement>('nala-sleep-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(sleeps.page).toHaveBeenCalledTimes(1);
  });

  it('opens the Sleep sheet directly on +, then reloads', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('sleep');
    expect(sleeps.page).toHaveBeenCalledTimes(2);
  });

  it('reloads once changes kept on the device have been sent', async () => {
    await respond([]);

    queue.sent.set(1);
    await fixture.whenStable();

    expect(sleeps.page).toHaveBeenCalledTimes(2);
  });

  it('reloads for the baby switched to', async () => {
    await respond([sleep('s1', 170, 80)]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(sleeps.page).toHaveBeenLastCalledWith('b2', null);
  });

  describe('while a sleep is live', () => {
    const live = (startMinutesAgo: number, overrides = {}) =>
      aSleep({ id: 's3', startTime: minutesAgo(startMinutesAgo), endTime: null, ...overrides });

    const noTimer = () => {
      expect(find('sleep-running')).toBeNull();
      expect(host().querySelector('nala-timer')).toBeNull();
      expect(find('timer-toggle')).toBeNull();
    };

    it('keeps the normal highlight and shows no timer or Stop', async () => {
      sync.inProgress.set([live(20)]);
      await respond([live(20), sleep('s2', 170, 80)]);

      expect(find('sleep-highlight')).not.toBeNull();
      expect(text('sleep-awake-for')).toBe('1h 20m');
      noTimer();
    });

    it('keeps the empty state without any stopped sleep', async () => {
      sync.inProgress.set([live(20)]);
      await respond([]);

      expect(find('empty-title')).not.toBeNull();
      noTimer();
    });

    it('replaces + by the timer button, which opens the live sleep', async () => {
      const current = live(20);
      sync.inProgress.set([current]);
      await respond([current]);

      expect(find('section-add')).toBeNull();
      find('section-live')!.click();

      expect(entrySheets.edit).toHaveBeenCalledWith('sleep', 'sleep', current);
    });

    it('lists the live sleep as the shared state has it now', async () => {
      await respond([live(20)]);
      sync.inProgress.set([live(30)]);
      await fixture.whenStable();

      const summary = host().querySelector('[data-testid="entry-summary"]')?.textContent?.trim();
      expect(summary).toBe('Sleeping · 30m');
    });

    it('reloads when a sleep becomes live or stops on any device', async () => {
      await respond([]);

      sync.inProgress.set([live(1)]);
      await fixture.whenStable();
      expect(sleeps.page).toHaveBeenCalledTimes(2);

      sync.inProgress.set([]);
      await fixture.whenStable();
      expect(sleeps.page).toHaveBeenCalledTimes(3);
    });

    it('warns "Still sleeping?" after 12 hours, and Review opens the sheet', async () => {
      const long = live(12 * 60 + 5);
      sync.inProgress.set([long]);
      await respond([long]);

      expect(text('banner-title')).toBe(en.sleep.stillSleeping.title);
      expect(text('banner-text')).toContain('12h 5m ago');
      expect(text('banner-action')).toBe(en.sleep.stillSleeping.review);

      find('banner-action')!.click();
      expect(entrySheets.edit).toHaveBeenCalledWith('sleep', 'sleep', long);
    });

    it('does not warn before 12 hours', async () => {
      sync.inProgress.set([live(12 * 60 - 1)]);
      await respond([]);

      expect(find('banner-title')).toBeNull();
    });
  });
});
