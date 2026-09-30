import { EMPTY, Observable, expand, last, map, take } from 'rxjs';
import { HistoryPageLoader } from './section.models';

/** How many of the most recent entries a section card always lists (spec 04). */
export const FOLDED_ENTRIES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Loaded<T> {
  entries: readonly T[];
  next: string | null;
}

/**
 * A section card's entries (spec 04), newest first: every entry started in the 24 hours before `now`,
 * and never fewer than the 3 most recent. Loads `loader`'s pages one after the other until one holds
 * an older entry (with 3 loaded) or it was the last page; emits once, and errors when a page fails.
 */
export function loadRecentEntries<T>(
  loader: HistoryPageLoader<T>,
  startedAt: (entry: T) => string,
  now: Date,
): Observable<readonly T[]> {
  const since = now.getTime() - DAY_MS;
  const recent = (entry: T) => new Date(startedAt(entry)).getTime() >= since;
  const done = ({ entries, next }: Loaded<T>) =>
    next === null || (entries.length >= FOLDED_ENTRIES && !entries.every(recent));

  const page = (cursor: string | null) => loader(cursor).pipe(take(1));

  return page(null).pipe(
    expand((loaded: Loaded<T>) =>
      done(loaded)
        ? EMPTY
        : page(loaded.next).pipe(
            map((more) => ({ entries: [...loaded.entries, ...more.entries], next: more.next })),
          ),
    ),
    last(),
    map(({ entries }) => entries.slice(0, Math.max(entries.filter(recent).length, FOLDED_ENTRIES))),
  );
}
