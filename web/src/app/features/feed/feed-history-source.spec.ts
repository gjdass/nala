import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Feed } from '../../core/feeds/feed.models';
import { FeedService } from '../../core/feeds/feed.service';
import { FeedEntryComponent } from './feed-entry/feed-entry.component';
import { FeedHistorySource } from './feed-history-source';

describe('FeedHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const entry = { id: 'f1', kind: 'bottle', startTime: '2026-10-09T08:30:00Z' } as unknown as Feed;
  let source: FeedHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: FeedService, useValue: service }] });
    source = TestBed.inject(FeedHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry by its startTime, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date('2026-10-09T08:30:00Z'));
    expect(source.kind(entry)).toBe('bottle');
  });

  it('lists an entry as FeedEntryComponent', () => {
    expect(source.item).toBe(FeedEntryComponent);
    expect(source.inputs(entry)).toEqual({ feed: entry });
  });
});
