import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { BreastfeedSyncService } from '../../../core/feeds/breastfeed-sync.service';
import { BreastfeedState, Feed, FeedResult } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { fakeBreastfeedSync } from '../../../testing/breastfeed-sync';
import { aBottle, aBreastfeed, aSegment } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FeedCardComponent } from './feed-card.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const baby = (id: string): Baby => ({
  id,
  name: id,
  birthDate: '2026-09-01',
  sex: 'unspecified',
  birthWeightG: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
});

describe('FeedCardComponent', () => {
  let fixture: ComponentFixture<FeedCardComponent>;
  let pages: Subject<HistoryPage<Feed>>[];
  let feeds: Record<
    'page' | 'breastfeedState' | 'startSide' | 'stopSide',
    ReturnType<typeof vi.fn>
  >;
  let timer: Subject<FeedResult>;
  let sync: ReturnType<typeof fakeBreastfeedSync>;
  let states: Subject<BreastfeedState>[];
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const respond = async (entries: Feed[]) => {
    pages.at(-1)!.next({ entries, next: null });
    await fixture.whenStable();
  };
  const respondState = async (state: BreastfeedState) => {
    states.at(-1)!.next(state);
    await fixture.whenStable();
  };
  const expand = async () => {
    find('section-toggle')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    states = [];
    timer = new Subject();
    sync = fakeBreastfeedSync();
    feeds = {
      startSide: vi.fn(() => timer),
      stopSide: vi.fn(() => timer),
      breastfeedState: vi.fn((): Observable<BreastfeedState> => {
        const state = new Subject<BreastfeedState>();
        states.push(state);
        return state;
      }),
      page: vi.fn((): Observable<HistoryPage<Feed>> => {
        const page = new Subject<HistoryPage<Feed>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { add: vi.fn(() => of({ saved: aBottle() })), edit: vi.fn(() => edited) };
    await TestBed.configureTestingModule({
      imports: [FeedCardComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: FeedService, useValue: feeds },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: BreastfeedSyncService, useValue: sync },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeedCardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('is the shared section card of the feed section', () => {
    expect(text('section-title')).toBe(en.sections.feed);
  });

  it('loads the 10 most recent feeds of the selected baby', () => {
    expect(feeds.page).toHaveBeenCalledWith('b1', null, 10);
  });

  it('shows the empty state without any feed', async () => {
    await respond([]);

    expect(text('empty-title')).toBe(en.feed.card.empty.title);
    expect(find('feed-highlight')).toBeNull();
  });

  it('highlights the time since the start of the latest feed, live', async () => {
    await respond([
      aBottle({ startTime: minutesAgo(26) }),
      aBottle({ id: 'f0', startTime: minutesAgo(200) }),
    ]);

    expect(text('feed-last-label')).toBe(en.feed.card.lastFeeding);
    expect(text('feed-last-since')).toBe('26m ago');

    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    expect(text('feed-last-since')).toBe('27m ago');
  });

  it('lists the recent feeds as entry items when expanded', async () => {
    await respond([
      aBottle({ id: 'f2', milkType: 'breastMilk', amountMl: 90 }),
      aBottle({ id: 'f1', milkType: 'formula', amountMl: 120 }),
    ]);
    await expand();

    const summaries = [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(summaries).toEqual(['Breast milk · 90 ml', 'Formula · 120 ml']);
  });

  it('opens a tapped feed in its kind sheet, then reloads', async () => {
    const feed = aBottle();
    await respond([feed]);
    await expand();

    host().querySelector<HTMLButtonElement>('nala-feed-entry button')!.click();
    expect(entrySheets.edit).toHaveBeenCalledWith('feed', 'bottle', feed);
    expect(feeds.page).toHaveBeenCalledTimes(1);

    edited.next({ saved: aBottle({ amountMl: 150 }) });
    edited.complete();
    await fixture.whenStable();
    expect(feeds.page).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the sheet closes without saving', async () => {
    await respond([aBottle()]);
    await expand();

    host().querySelector<HTMLButtonElement>('nala-feed-entry button')!.click();
    edited.next(undefined);
    edited.complete();
    await fixture.whenStable();

    expect(feeds.page).toHaveBeenCalledTimes(1);
  });

  it('reloads after an entry is added through +', async () => {
    await respond([]);

    find('section-add')!.click();
    await fixture.whenStable();

    expect(feeds.page).toHaveBeenCalledTimes(2);
  });

  it('reloads for the baby switched to', async () => {
    await respond([aBottle()]);

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(feeds.page).toHaveBeenLastCalledWith('b2', null, 10);
  });

  it('shows the side the latest saved breastfeed ended on, labelled last side', async () => {
    await respond([aBottle({ startTime: minutesAgo(26) })]);
    await respondState({ inProgress: null, lastSide: 'right' });

    expect(feeds.breastfeedState).toHaveBeenCalledWith('b1');
    expect(text('feed-last-side')).toBe(en.feed.card.side.right);
    expect(text('feed-last-side-label')).toBe(en.feed.card.lastSide);
    const since = find('feed-last-since')!;
    expect(
      since.compareDocumentPosition(find('feed-last-side')!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hides the last side without any saved breastfeed', async () => {
    await respond([aBottle()]);
    await respondState({ inProgress: null, lastSide: null });

    expect(find('feed-last-side')).toBeNull();
    expect(find('feed-last-side-label')).toBeNull();
  });

  it('reloads the last side with the feeds', async () => {
    await respond([aBottle()]);

    find('section-add')!.click();
    await fixture.whenStable();
    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(feeds.breastfeedState).toHaveBeenCalledTimes(3);
    expect(feeds.breastfeedState).toHaveBeenLastCalledWith('b2');
  });

  /** In progress for baby b1 since `startedMinutesAgo`, right side running after 5 min on the left. */
  const inProgress = (startedMinutesAgo: number, overrides: Partial<Feed> = {}) =>
    aBreastfeed({
      startTime: minutesAgo(startedMinutesAgo),
      endTime: null,
      segments: [
        aSegment('left', minutesAgo(startedMinutesAgo), minutesAgo(startedMinutesAgo - 5)),
        aSegment('right', minutesAgo(startedMinutesAgo - 5), null),
      ],
      ...overrides,
    });
  const showInProgress = async (feed: Feed | null) => {
    sync.inProgress.set(feed ? [feed] : []);
    await fixture.whenStable();
  };

  describe('running state', () => {
    it('replaces the highlight with Feeding and both sides live, the running side marked', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(12));

      expect(find('feed-highlight')).toBeNull();
      expect(text('feed-running-open')).toBe(en.feed.card.feeding);
      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-duration')).toBe('7m');
      expect(text('split-right-toggle')).toBe(en.splitTimer.stop);
      expect(host().querySelector('nala-split-timer .compact')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(3_000);
      await fixture.whenStable();
      expect(text('split-right-duration')).toBe('7m 3s');
    });

    it('shows even without any saved feed', async () => {
      await respond([]);
      await showInProgress(inProgress(12));

      expect(find('feed-running-open')).not.toBeNull();
      expect(find('empty-title')).toBeNull();
    });

    it("is not shown for another baby's feed", async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(12, { babyId: 'b2' }));

      expect(find('feed-running-open')).toBeNull();
      expect(find('feed-highlight')).not.toBeNull();
    });

    it('pauses on the running side Stop, applying the result at once', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(12));

      find('split-right-toggle')!.click();
      expect(feeds.stopSide).toHaveBeenCalledWith('f3', NOW.toISOString());

      const paused = inProgress(12, { updatedAt: NOW.toISOString() });
      timer.next({ ok: true, feed: paused });
      expect(sync.puts).toEqual([paused]);
    });

    it('switches side on the other side Start', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(12));

      find('split-left-toggle')!.click();

      expect(feeds.startSide).toHaveBeenCalledWith('f3', 'b1', 'left', NOW.toISOString());
    });

    it('opens the Breastfeed sheet on Feeding', async () => {
      const feed = inProgress(12);
      await respond([aBottle()]);
      await showInProgress(feed);

      find('feed-running-open')!.click();

      expect(entrySheets.edit).toHaveBeenCalledWith('feed', 'breastfeed', feed);
    });

    it('reloads the feeds and last side once the feed is saved or deleted anywhere', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(12));
      expect(feeds.page).toHaveBeenCalledTimes(1);

      await showInProgress(null);

      expect(feeds.page).toHaveBeenCalledTimes(2);
      expect(feeds.breastfeedState).toHaveBeenCalledTimes(2);
      expect(find('feed-running-open')).toBeNull();
    });
  });

  describe('Still feeding?', () => {
    it('warns about a breastfeed in progress that started more than 3 hours ago', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(192));

      expect(text('banner-title')).toBe(en.feed.breastfeed.stillFeeding.title);
      expect(text('banner-text')).toContain('3h 12m ago');
      expect(text('banner-action')).toBe(en.feed.breastfeed.stillFeeding.review);
    });

    it('warns even without any saved feed', async () => {
      await respond([]);
      await showInProgress(inProgress(200));

      expect(find('banner-title')).not.toBeNull();
    });

    it('appears live once the 3 hours have passed', async () => {
      await respond([aBottle()]);
      await showInProgress(inProgress(179));
      expect(find('banner-title')).toBeNull();

      await vi.advanceTimersByTimeAsync(2 * 60_000);
      await fixture.whenStable();

      expect(find('banner-title')).not.toBeNull();
    });

    it('opens the feed in the Breastfeed sheet on Review', async () => {
      const feed = inProgress(200);
      await respond([aBottle()]);
      await showInProgress(feed);

      find('banner-action')!.click();

      expect(entrySheets.edit).toHaveBeenCalledWith('feed', 'breastfeed', feed);
    });
  });
});
