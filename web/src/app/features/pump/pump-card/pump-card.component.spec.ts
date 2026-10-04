import { ComponentFixture, TestBed } from '@angular/core/testing';
import { inject, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { PumpSyncService } from '../../../core/pumps/pump-sync.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { RUNNING_TIMER_SOURCES } from '../../../core/timers/running-timer.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { fakePumpSync } from '../../../testing/pump-sync';
import { aPump } from '../../../testing/pumps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { PumpTimerSource } from '../pump-timers';
import { PumpCardComponent } from './pump-card.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string) => ({ id, name: id }) as Baby;
/** A 20-minute session that started `ago` minutes ago. */
const pump = (id: string, ago: number, overrides: Partial<Pump> = {}) =>
  aPump({ id, startTime: minutesAgo(ago), endTime: minutesAgo(ago - 20), ...overrides });

describe('PumpCardComponent', () => {
  let fixture: ComponentFixture<PumpCardComponent>;
  let pages: Subject<HistoryPage<Pump>>[];
  let pumps: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;
  let sync: ReturnType<typeof fakePumpSync>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: Pump[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
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
    entrySheets = { add: vi.fn(() => of({ saved: aPump() })), edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    sync = fakePumpSync();
    await TestBed.configureTestingModule({
      imports: [PumpCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: PumpService, useValue: pumps },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
        { provide: PumpSyncService, useValue: sync },
        { provide: RUNNING_TIMER_SOURCES, useFactory: () => [inject(PumpTimerSource)] },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PumpCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the pump section', () => {
    expect(text('section-title')).toBe(en.sections.pump);
  });

  it('loads the sessions of the selected baby page by page', () => {
    expect(pumps.page).toHaveBeenCalledWith('b1', null);
  });

  it('shows the empty state without any session', async () => {
    await respond([]);

    expect(text('empty-title')).toBe(en.pump.card.empty.title);
    expect(find('pump-highlight')).toBeNull();
  });

  it('highlights the time since the start of the most recent session, live', async () => {
    await respond([pump('p2', 46.5), pump('p1', 200)]);

    expect(text('pump-last-label')).toBe(en.pump.card.lastPumped);
    expect(text('pump-since')).toBe('46m');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('pump-since')).toBe('47m');
  });

  it('takes the latest start among the loaded sessions', async () => {
    await respond([pump('p1', 200), pump('p2', 80)]);

    expect(text('pump-since')).toBe('1h 20m');
  });

  it('ignores a live session', async () => {
    await respond([pump('p2', 10, { endTime: null }), pump('p1', 80)]);

    expect(text('pump-since')).toBe('1h 20m');
  });

  it('shows the time since in hours and minutes only, <1m under a minute', async () => {
    await respond([pump('p1', 0.5, { endTime: minutesAgo(0.2) })]);

    expect(text('pump-since')).toBe('<1m');
  });

  it('caps the time since at >24h', async () => {
    await respond([pump('p1', 25 * 60)]);

    expect(text('pump-since')).toBe('>24h');
  });

  it("shows that session's total on the right", async () => {
    await respond([pump('p2', 30, { leftMl: 90, rightMl: 90 }), pump('p1', 200)]);

    expect(text('pump-last-total')).toBe('180 ml');
    expect(
      find('pump-since')!.compareDocumentPosition(find('pump-last-total')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows "—" when that session has no volume', async () => {
    await respond([pump('p1', 30, { leftMl: null, rightMl: null })]);

    expect(text('pump-last-total')).toBe('—');
  });

  it('lists the recent sessions as entry items', async () => {
    await respond([pump('p2', 30, { leftMl: 50, rightMl: null }), pump('p1', 200)]);

    const labels = [...host().querySelectorAll('[data-testid="entry-label"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['50 ml', '170 ml']);
  });

  it('opens a tapped session in the Pump sheet, then reloads', async () => {
    const tapped = pump('p1', 30);
    await respond([tapped]);

    host().querySelector<HTMLButtonElement>('nala-pump-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('pump', 'pump', tapped);
    expect(pumps.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: tapped });
    edited.complete();
    await fixture.whenStable();
    expect(pumps.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([pump('p1', 30)]);

    host().querySelector<HTMLButtonElement>('nala-pump-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(pumps.page).toHaveBeenCalledTimes(1);
  });

  it('opens the Pump sheet directly on +, then reloads', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(entrySheets.add).toHaveBeenCalledWith('pump');
    expect(pumps.page).toHaveBeenCalledTimes(2);
  });

  it('reloads once changes kept on the device have been sent', async () => {
    await respond([]);

    queue.sent.set(1);
    await fixture.whenStable();

    expect(pumps.page).toHaveBeenCalledTimes(2);
  });

  it('reloads for the baby switched to', async () => {
    await respond([pump('p1', 30)]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(pumps.page).toHaveBeenLastCalledWith('b2', null);
  });

  describe('while a session is live', () => {
    const live = (startMinutesAgo: number, overrides: Partial<Pump> = {}) =>
      aPump({ id: 'p3', startTime: minutesAgo(startMinutesAgo), endTime: null, ...overrides });

    const noTimer = () => {
      expect(host().querySelector('nala-timer')).toBeNull();
      expect(find('timer-toggle')).toBeNull();
    };

    it('keeps the normal highlight and shows no timer or Stop', async () => {
      sync.inProgress.set([live(10)]);
      await respond([live(10), pump('p2', 90)]);

      expect(find('pump-highlight')).not.toBeNull();
      expect(text('pump-since')).toBe('1h 30m');
      noTimer();
    });

    it('keeps the empty state without any stopped session', async () => {
      sync.inProgress.set([live(10)]);
      await respond([]);

      expect(find('empty-title')).not.toBeNull();
      noTimer();
    });

    it('replaces + by the timer button, which opens the live session', async () => {
      const current = live(10);
      sync.inProgress.set([current]);
      await respond([current]);

      expect(find('section-add')).toBeNull();
      find('section-live')!.click();

      expect(entrySheets.edit).toHaveBeenCalledWith('pump', 'pump', current);
    });

    it('lists the live session as the shared state has it now', async () => {
      await respond([live(10)]);
      sync.inProgress.set([live(12)]);
      await fixture.whenStable();

      const summary = host().querySelector('[data-testid="entry-summary"]')?.textContent?.trim();
      expect(summary).toBe('Pumping · 12m');
    });

    it('reloads when a session becomes live or stops on any device', async () => {
      await respond([]);

      sync.inProgress.set([live(1)]);
      await fixture.whenStable();
      expect(pumps.page).toHaveBeenCalledTimes(2);

      sync.inProgress.set([]);
      await fixture.whenStable();
      expect(pumps.page).toHaveBeenCalledTimes(3);
    });

    it('warns "Still pumping?" after 1 hour, and Review opens the sheet', async () => {
      const long = live(65);
      sync.inProgress.set([long]);
      await respond([long]);

      expect(text('banner-title')).toBe(en.pump.stillPumping.title);
      expect(text('banner-text')).toContain('1h 5m ago');
      expect(text('banner-action')).toBe(en.pump.stillPumping.review);

      find('banner-action')!.click();
      expect(entrySheets.edit).toHaveBeenCalledWith('pump', 'pump', long);
    });

    it('does not warn before 1 hour', async () => {
      sync.inProgress.set([live(59)]);
      await respond([]);

      expect(find('banner-title')).toBeNull();
    });
  });
});
