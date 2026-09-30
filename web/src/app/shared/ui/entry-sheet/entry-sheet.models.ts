import { SectionKey, SectionKind } from '../../../core/sections/section.models';

/** The data a kind's sheet is opened with (`SHEET_DATA`); `entry` is null when adding. */
export interface EntrySheetData<T = unknown> {
  section: SectionKey;
  kind: SectionKind;
  entry: T | null;
}

/**
 * What a kind's sheet closes with: the saved entry, the id of the deleted one, or `queued` when the
 * change is kept on the device until back online (lists stay as they are until it is sent).
 */
export type EntrySheetResult<T = unknown> = { saved: T } | { deleted: string } | { queued: true };
