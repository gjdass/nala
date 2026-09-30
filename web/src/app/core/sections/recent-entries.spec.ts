import { Observable, Subject, of, throwError } from 'rxjs';
import { loadRecentEntries } from './recent-entries';
import { HistoryPage } from './section.models';

interface Entry {
  id: string;
  startTime: string;
}

const NOW = new Date('2026-09-30T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const entry = (id: string, hours: number): Entry => ({ id, startTime: hoursAgo(hours) });
const startedAt = (e: Entry) => e.startTime;

/** A loader serving `pages` in order, recording the cursors it was asked. */
const pagesLoader = (pages: readonly Entry[][]) => {
  const cursors: (string | null)[] = [];
  const loader = (cursor: string | null): Observable<HistoryPage<Entry>> => {
    cursors.push(cursor);
    const index = cursor === null ? 0 : Number(cursor);
    const next = index + 1 < pages.length ? String(index + 1) : null;
    return of({ entries: pages[index], next });
  };
  return { loader, cursors };
};

const load = (loader: (cursor: string | null) => Observable<HistoryPage<Entry>>, now = NOW) => {
  let result: readonly Entry[] | undefined;
  let error: unknown;
  loadRecentEntries(loader, startedAt, now).subscribe({
    next: (entries) => (result = entries),
    error: (e) => (error = e),
  });
  return { ids: () => result?.map((e) => e.id), result: () => result, error: () => error };
};

describe('loadRecentEntries', () => {
  it('asks the first page and returns its entries of the last 24 hours', () => {
    const { loader, cursors } = pagesLoader([
      [entry('a', 1), entry('b', 2), entry('c', 3), entry('d', 23), entry('e', 25)],
      [entry('f', 30)],
    ]);

    expect(load(loader).ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(cursors).toEqual([null]);
  });

  it('loads the next pages while every entry is within 24 hours, up to the first older one', () => {
    const { loader, cursors } = pagesLoader([
      [entry('a', 1), entry('b', 2)],
      [entry('c', 3), entry('d', 4)],
      [entry('e', 5), entry('f', 26)],
      [entry('g', 30)],
    ]);

    expect(load(loader).ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(cursors).toEqual([null, '1', '2']);
  });

  it('stops after the last page', () => {
    const { loader, cursors } = pagesLoader([[entry('a', 1)], [entry('b', 2), entry('c', 3)]]);

    expect(load(loader).ids()).toEqual(['a', 'b', 'c']);
    expect(cursors).toEqual([null, '1']);
  });

  it('never returns fewer than the 3 most recent entries, even older than 24 hours', () => {
    const { loader } = pagesLoader([
      [entry('a', 1), entry('b', 30), entry('c', 40), entry('d', 50)],
    ]);

    expect(load(loader).ids()).toEqual(['a', 'b', 'c']);
  });

  it('keeps loading until it has 3 entries when pages are small', () => {
    const { loader, cursors } = pagesLoader([
      [entry('a', 30)],
      [entry('b', 40)],
      [entry('c', 50)],
      [entry('d', 60)],
    ]);

    expect(load(loader).ids()).toEqual(['a', 'b', 'c']);
    expect(cursors).toEqual([null, '1', '2']);
  });

  it('returns no entry when there is none', () => {
    const { loader } = pagesLoader([[]]);

    expect(load(loader).result()).toEqual([]);
  });

  it('takes the 24 hours window from the time it is given', () => {
    const { loader } = pagesLoader([
      [entry('a', 1), entry('b', 2), entry('c', 3), entry('d', 10), entry('e', 20)],
    ]);
    const later = new Date(NOW.getTime() + 8 * 3_600_000);

    expect(load(loader, later).ids()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('emits once, after the last page it needs', () => {
    const first = new Subject<HistoryPage<Entry>>();
    const second = new Subject<HistoryPage<Entry>>();
    const loader = (cursor: string | null) => (cursor === null ? first : second);
    const { result } = load(loader);

    first.next({ entries: [entry('a', 1)], next: 'n' });
    expect(result()).toBeUndefined();

    second.next({ entries: [entry('b', 30)], next: null });
    expect(result()?.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('errors when a page fails', () => {
    const failure = new Error('offline');
    const loader = (cursor: string | null): Observable<HistoryPage<Entry>> =>
      cursor === null ? of({ entries: [entry('a', 1)], next: 'n' }) : throwError(() => failure);

    const { error, result } = load(loader);

    expect(error()).toBe(failure);
    expect(result()).toBeUndefined();
  });
});
