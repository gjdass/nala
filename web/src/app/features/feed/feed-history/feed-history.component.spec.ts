import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Feed } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { aBottle } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FeedHistoryComponent } from './feed-history.component';

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

describe('FeedHistoryComponent', () => {
  let fixture: ComponentFixture<FeedHistoryComponent>;
  let pages: Subject<HistoryPage<Feed>>[];
  let feeds: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const summaries = () =>
    [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) => e.textContent?.trim());

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
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
    entrySheets = { edit: vi.fn(() => edited) };
    await TestBed.configureTestingModule({
      imports: [FeedHistoryComponent, translocoTesting()],
      providers: [
        { provide: FeedService, useValue: feeds },
        { provide: SelectedBabyService, useValue: { selected } },
        { provide: EntrySheetService, useValue: entrySheets },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeedHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(feeds.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [aBottle({ id: 'f2', amountMl: 90 })], next: 'c2' });
    await fixture.whenStable();
    expect(feeds.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [aBottle({ id: 'f1', amountMl: 120 })], next: null });
    await fixture.whenStable();
    expect(summaries()).toEqual(['Formula · 90 ml', 'Formula · 120 ml']);
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [aBottle()], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(feeds.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens a feed for editing and puts the saved one back in place', async () => {
    const feed = aBottle({ id: 'f1', amountMl: 120 });
    pages[0].next({ entries: [aBottle({ id: 'f2', amountMl: 90 }), feed], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-feed-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('feed', 'bottle', feed);

    edited.next({ saved: aBottle({ id: 'f1', amountMl: 150 }) });
    await fixture.whenStable();
    expect(summaries()).toEqual(['Formula · 90 ml', 'Formula · 150 ml']);
    expect(feeds.page).toHaveBeenCalledTimes(1);
  });

  it('removes a feed deleted from the history', async () => {
    pages[0].next({
      entries: [aBottle({ id: 'f2', amountMl: 90 }), aBottle({ id: 'f1' })],
      next: null,
    });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-feed-entry button')[0].click();
    edited.next({ deleted: 'f2' });
    await fixture.whenStable();

    expect(summaries()).toEqual(['Formula · 120 ml']);
  });
});
