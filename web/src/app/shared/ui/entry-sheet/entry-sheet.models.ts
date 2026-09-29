import { SectionKey, SectionKind } from '../../../core/sections/section.models';

/** The data a kind's sheet is opened with (`SHEET_DATA`); `entry` is null when adding. */
export interface EntrySheetData<T = unknown> {
  section: SectionKey;
  kind: SectionKind;
  entry: T | null;
}

/** What a kind's sheet closes with: the saved entry, or the id of the deleted one. */
export type EntrySheetResult<T = unknown> = { saved: T } | { deleted: string };
