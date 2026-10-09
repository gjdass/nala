import { Type } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { HistoryPage, HistoryPageLoader, SectionKey } from '../sections/section.models';
import { HistoryItem, HistorySource } from './history-source.models';
import { MERGED_PAGE_SIZE, SECTION_PAGE_SIZE, mergedHistoryLoader } from './merged-history-loader';

interface Entry {
  id: string;
  at: string;
}

const NOW = new Date('2026-10-09T12:00:00Z');
const SINCE = new Date(NOW.getTime() - 24 * 3_600_000);
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const entry = (id: string, minutes: number): Entry => ({ id, at: minutesAgo(minutes) });

/**
 * A fake source serving `entries` (newest first) in pages of the asked limit, recording the calls;
 * `failAt` makes the call with that index fail once.
 */
const fakeSource = (entries: readonly Entry[], failAt?: number) => {
  const calls: { babyId: string; cursor: string | null; limit: number }[] = [];
  let failed = false;
  const source: HistorySource<Entry> = {
    page(babyId, cursor, limit): Observable<HistoryPage<Entry>> {
      calls.push({ babyId, cursor, limit });
      if (failAt !== undefined && calls.length - 1 === failAt && !failed) {
        failed = true;
        return throwError(() => new Error('offline'));
      }
      const start = cursor === null ? 0 : Number(cursor);
      const end = start + limit;
      return of({
        entries: entries.slice(start, end),
        next: end < entries.length ? String(end) : null,
      });
    },
    time: (e) => new Date(e.at),
    kind: () => 'k',
    item: class {} as Type<unknown>,
    inputs: (e) => ({ e }),
  };
  return { source: source as HistorySource, calls };
};

/** Runs one call of `loader`, returning the page or the error. */
const call = (loader: HistoryPageLoader<HistoryItem>, cursor: string | null) => {
  let page: HistoryPage<HistoryItem> | undefined;
  let error: unknown;
  loader(cursor).subscribe({ next: (p) => (page = p), error: (e) => (error = e) });
  return { page, error };
};

/** Every page of `loader`, from the first to the last. */
const all = (loader: HistoryPageLoader<HistoryItem>) => {
  const pages: HistoryPage<HistoryItem>[] = [];
  let cursor: string | null = null;
  do {
    const { page } = call(loader, cursor);
    pages.push(page!);
    cursor = page!.next;
  } while (cursor !== null);
  return pages;
};

const ids = (pages: readonly HistoryPage<HistoryItem>[]) =>
  pages.flatMap((p) => p.entries.map((i) => `${i.section}:${i.id}`));

const many = (prefix: string, count: number, everyMinutes: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => entry(`${prefix}${i}`, offset + i * everyMinutes));

describe('mergedHistoryLoader', () => {
  const merge = (sections: [SectionKey, HistorySource][]) =>
    mergedHistoryLoader(
      sections.map(([key, source]) => ({ key, source })),
      'baby-1',
      SINCE,
    );

  it('interleaves the sections newest first, ties by home order then the section own order', () => {
    const feed = fakeSource([entry('f1', 10), entry('f2', 30), entry('f3', 30)]);
    const diaper = fakeSource([entry('d1', 5), entry('d2', 30)]);

    const pages = all(
      merge([
        ['diaper', diaper.source],
        ['feed', feed.source],
      ]),
    );

    expect(ids(pages)).toEqual(['diaper:d1', 'feed:f1', 'diaper:d2', 'feed:f2', 'feed:f3']);
    expect(pages[0].entries[0]).toEqual({
      id: 'd1',
      section: 'diaper',
      entry: entry('d1', 5),
    });
  });

  it('never lists an entry older than the window, and stops reading a section once one is older', () => {
    const inWindow = many('f', 49, 1);
    const feed = fakeSource([...inWindow, entry('old', 25 * 60), ...many('older', 60, 1, 26 * 60)]);

    const pages = all(merge([['feed', feed.source]]));

    expect(ids(pages)).toEqual(inWindow.map((e) => `feed:${e.id}`));
    expect(feed.calls).toEqual([{ babyId: 'baby-1', cursor: null, limit: SECTION_PAGE_SIZE }]);
  });

  it('reads a section page after page of 50 until its last one', () => {
    const feed = fakeSource(many('f', 120, 1));

    const pages = all(merge([['feed', feed.source]]));

    expect(ids(pages)).toHaveLength(120);
    expect(feed.calls.map((c) => [c.cursor, c.limit])).toEqual([
      [null, 50],
      ['50', 50],
      ['100', 50],
    ]);
  });

  it('hands out pages of 20 in final order, the last with no next', () => {
    const feed = fakeSource(many('f', 30, 2));
    const sleep = fakeSource(many('s', 15, 2, 1));

    const pages = all(
      merge([
        ['feed', feed.source],
        ['sleep', sleep.source],
      ]),
    );

    expect(MERGED_PAGE_SIZE).toBe(20);
    expect(pages.map((p) => p.entries.length)).toEqual([20, 20, 5]);
    expect(pages.at(-1)!.next).toBeNull();
    const times = pages.flatMap((p) => p.entries.map((i) => new Date((i.entry as Entry).at)));
    expect(times).toEqual([...times].sort((a, b) => b.getTime() - a.getTime()));
  });

  it('reads a section next page only when its loaded entries run out, still in order', () => {
    // 60 feeds a minute apart, then one diaper older than all of them: the diaper waits for every feed.
    const feed = fakeSource(many('f', 60, 1));
    const diaper = fakeSource([entry('d', 90)]);

    const pages = all(
      merge([
        ['feed', feed.source],
        ['diaper', diaper.source],
      ]),
    );

    expect(ids(pages)).toEqual([...many('f', 60, 1).map((e) => `feed:${e.id}`), 'diaper:d']);
    expect(feed.calls.map((c) => c.cursor)).toEqual([null, '50']);
    expect(diaper.calls).toHaveLength(1);
  });

  it('fails the load when a section page fails, and Try again goes on with no gap nor duplicate', () => {
    const feed = fakeSource(many('f', 60, 1), 1);
    const sleep = fakeSource(many('s', 10, 7));
    const loader = merge([
      ['feed', feed.source],
      ['sleep', sleep.source],
    ]);

    // The feed's second page fails once: the page asking for it errors, the same call again works.
    const pages: HistoryPage<HistoryItem>[] = [];
    const errors: unknown[] = [];
    let cursor: string | null = null;
    do {
      const { page, error } = call(loader, cursor);
      if (error) {
        expect(page).toBeUndefined();
        errors.push(error);
        continue;
      }
      pages.push(page!);
      cursor = page!.next;
    } while (cursor !== null);

    expect(errors).toHaveLength(1);
    expect(feed.calls.map((c) => c.cursor)).toEqual([null, '50', '50']);

    const expected = all(
      merge([
        ['feed', fakeSource(many('f', 60, 1)).source],
        ['sleep', fakeSource(many('s', 10, 7)).source],
      ]),
    );
    expect(ids(pages)).toEqual(ids(expected));
  });

  it('starts again from the first page when asked with no cursor', () => {
    const feed = fakeSource(many('f', 30, 1));
    const loader = merge([['feed', feed.source]]);

    const first = call(loader, null).page!;
    call(loader, first.next);
    const again = call(loader, null).page!;

    expect(again).toEqual(first);
  });

  it('lists nothing, with no next, when no entry falls in the window', () => {
    const feed = fakeSource([entry('old', 25 * 60)]);

    expect(all(merge([['feed', feed.source]]))).toEqual([{ entries: [], next: null }]);
  });
});
