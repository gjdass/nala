import { Type } from '@angular/core';
import { Observable } from 'rxjs';
import { HistoryPage, SectionKey } from '../sections/section.models';

/**
 * What a section gives History (spec 11): its pages for a baby, each entry's time (for the window and
 * the order) and kind (to open its sheet), and its list item. Each section registers one through
 * `SectionDefinition.loadSource`, as an injectable class loaded on demand.
 */
export interface HistorySource<T extends { id: string } = { id: string }> {
  /** One page of the baby's entries, newest first, of at most `limit`. */
  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<T>>;
  /** The entry's time; a date-only entry counts as local midnight of its date. */
  time(entry: T): Date;
  /** The entry's kind, for `EntrySheetService.edit(section, kind, entry)`. */
  kind(entry: T): string;
  /** The entry's list item component (`nala-feed-entry`…), which emits `open` when tapped. */
  readonly item: Type<unknown>;
  /** The list item's inputs for the entry. */
  inputs(entry: T): Record<string, unknown>;
}

/** Loads a section's history source class on demand: `() => import('./x-history-source').then((m) => m.X)`. */
export type HistorySourceLoader = () => Promise<Type<HistorySource>>;

/** One entry of History's merged list, with the section it comes from. */
export interface HistoryItem {
  id: string;
  section: SectionKey;
  entry: { id: string };
}
