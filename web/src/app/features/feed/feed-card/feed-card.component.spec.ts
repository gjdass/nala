import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Feed } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aBottle } from '../../../testing/feeds';
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
  let feeds: { page: ReturnType<typeof vi.fn> };
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
  const expand = async () => {
    find('section-toggle')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    pages = [];
    feeds = {
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
});
