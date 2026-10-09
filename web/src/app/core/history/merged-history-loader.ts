import { Observable, defer, forkJoin, map, of, switchMap } from 'rxjs';
import { HistoryPage, HistoryPageLoader, SectionKey } from '../sections/section.models';
import { HistoryItem, HistorySource } from './history-source.models';

/** How many entries History asks a section for at once (the API's largest page; spec 11). */
export const SECTION_PAGE_SIZE = 50;

/** How many items each page of History's merged list holds (spec 11). */
export const MERGED_PAGE_SIZE = 20;

interface SectionState {
  /** Entries in the window, read but not handed out yet, newest first. */
  buffer: readonly { id: string }[];
  cursor: string | null;
  /** After the section's last page, or once one of its entries is older than the window. */
  done: boolean;
}

/**
 * History's merged list (spec 11): the entries of `sections` (in home order) whose time is at or
 * after `since`, newest first, ties by section in that order then the section's own order. Reads each
 * section's pages of 50 only as needed, and only until one of its entries is older than `since`;
 * hands out pages of 20. A page works on a copy of the state, kept only once the page is out, so a
 * failed section page fails the load and calling again with the same cursor (Try again) loses nothing.
 * Asked with no cursor, it starts again from the first page.
 */
export function mergedHistoryLoader(
  sections: readonly { key: SectionKey; source: HistorySource }[],
  babyId: string,
  since: Date,
): HistoryPageLoader<HistoryItem> {
  const start = (): SectionState[] =>
    sections.map(() => ({ buffer: [], cursor: null, done: false }));
  let state = start();
  let pageNumber = 0;

  /** Reads the next page of every section that has nothing left to hand out yet. */
  const fill = (states: SectionState[]): Observable<SectionState[]> => {
    const reads = states.map((s, i) =>
      s.done || s.buffer.length > 0
        ? of(s)
        : sections[i].source.page(babyId, s.cursor, SECTION_PAGE_SIZE).pipe(
            map((page): SectionState => {
              const time = (e: { id: string }) => sections[i].source.time(e).getTime();
              const inWindow = page.entries.filter((e) => time(e) >= since.getTime());
              return {
                buffer: inWindow,
                cursor: page.next,
                done: page.next === null || inWindow.length < page.entries.length,
              };
            }),
          ),
    );
    return reads.length ? forkJoin(reads) : of([]);
  };

  /** Takes items newest first until the page is full, or a section must read more first. */
  const take = (
    states: SectionState[],
    items: HistoryItem[],
  ): Observable<{ states: SectionState[]; items: HistoryItem[] }> =>
    fill(states).pipe(
      switchMap((filled) => {
        const next = [...filled];
        const taken = [...items];
        while (taken.length < MERGED_PAGE_SIZE) {
          if (next.some((s) => !s.done && s.buffer.length === 0)) {
            return take(next, taken);
          }
          const newest = newestHead(next);
          if (newest < 0) {
            break;
          }
          const [entry, ...rest] = next[newest].buffer;
          next[newest] = { ...next[newest], buffer: rest };
          taken.push({ id: entry.id, section: sections[newest].key, entry });
        }
        return of({ states: next, items: taken });
      }),
    );

  /** The section whose next entry is the newest, the first in home order on a tie; -1 when none is left. */
  const newestHead = (states: readonly SectionState[]): number => {
    const headTime = (i: number) => sections[i].source.time(states[i].buffer[0]).getTime();
    let newest = -1;
    states.forEach((s, i) => {
      if (s.buffer.length > 0 && (newest < 0 || headTime(i) > headTime(newest))) {
        newest = i;
      }
    });
    return newest;
  };

  return (cursor) =>
    defer(() => {
      const from = cursor === null ? start() : state;
      return take(from, []).pipe(
        map(({ states, items }): HistoryPage<HistoryItem> => {
          state = states;
          pageNumber = cursor === null ? 1 : pageNumber + 1;
          const more = states.some((s) => !s.done || s.buffer.length > 0);
          return { entries: items, next: more ? String(pageNumber) : null };
        }),
      );
    });
}
