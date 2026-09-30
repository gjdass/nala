import { InjectionToken, Type } from '@angular/core';
import { Observable } from 'rxjs';
import { FieldErrors } from '../auth/auth.models';

/** Every home section, in the default order (the API owns the list; spec 04). */
export const SECTION_KEYS = ['feed', 'sleep', 'diaper', 'pump', 'growth', 'medication'] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** One section of the user's home, in their order. */
export interface SectionPreference {
  key: SectionKey;
  visible: boolean;
}

export type SectionsSaveResult = { ok: true } | { ok: false; errors: FieldErrors };

/**
 * Loads a component on demand, so a section's card, history and sheets stay out of the initial bundle:
 * `() => import('./x.component').then((m) => m.XComponent)`.
 */
export type ComponentLoader = () => Promise<Type<unknown>>;

/** One kind of entry of a section (e.g. Feed: bottle, breastfeed, solids). */
export interface SectionKind {
  key: string;
  /** Material Symbols name. */
  icon: string;
  /** Translation key of its label, shown in the kind picker and as its sheet title. */
  label: string;
  /** Loads its add / edit sheet, wrapping `nala-entry-sheet`; opened with `EntrySheetData`. */
  loadSheet: ComponentLoader;
}

/**
 * A section the app has built; each feature registers its own through `SECTIONS`. The entry is part of
 * the initial bundle, so it only holds loaders for its components, never the components themselves.
 */
export interface SectionDefinition {
  key: SectionKey;
  /** Material Symbols name. */
  icon: string;
  /** Loads the section's home card, which loads its own entries for the selected baby and wraps `nala-section-card`. */
  loadCard: ComponentLoader;
  /** Its kinds of entry: + opens the kind picker with several, the sheet directly with one. */
  kinds: readonly SectionKind[];
  /** Loads its history list, which loads its pages for the selected baby and wraps `nala-history-list`. */
  loadHistory: ComponentLoader;
}

/** One page of a section's history, newest first; `next` is the cursor of the following page, null after the last. */
export interface HistoryPage<T> {
  entries: readonly T[];
  next: string | null;
}

/** Loads one page of a section's history: null for the first page, then the previous page's `next`; errors when it fails. */
export type HistoryPageLoader<T> = (cursor: string | null) => Observable<HistoryPage<T>>;

/** The built sections; home and settings only show these. */
export const SECTIONS = new InjectionToken<readonly SectionDefinition[]>('SECTIONS', {
  providedIn: 'root',
  factory: () => [],
});
