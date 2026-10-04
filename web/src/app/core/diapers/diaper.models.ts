import { UserName } from '../entries/entry.models';

/** A dirty diaper's colours (spec 07); black, red and white are the ones paediatricians flag. */
export const DIAPER_COLORS = ['yellow', 'green', 'brown', 'black', 'red', 'white'] as const;
export type DiaperColor = (typeof DIAPER_COLORS)[number];

/** A dirty diaper's consistencies (spec 07). */
export const DIAPER_CONSISTENCIES = ['liquid', 'runny', 'soft', 'firm', 'hard'] as const;
export type DiaperConsistency = (typeof DIAPER_CONSISTENCIES)[number];

/** A diaper change as the API returns it (spec 07); neither wet nor dirty is a dry diaper. */
export interface Diaper {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  time: string;
  wet: boolean;
  dirty: boolean;
  rash: boolean;
  /** Only for a dirty diaper; null otherwise. */
  color: DiaperColor | null;
  /** Only for a dirty diaper; null otherwise. */
  consistency: DiaperConsistency | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Diaper sheet sends, to add or to edit. */
export interface DiaperFields {
  time: string;
  wet: boolean;
  dirty: boolean;
  rash: boolean;
  /** Sent as null unless dirty. */
  color: DiaperColor | null;
  consistency: DiaperConsistency | null;
  notes: string | null;
}

/** A diaper's type, derived from its wet and dirty toggles, as a translation key suffix (`diaper.type.`). */
export type DiaperType = 'wet' | 'dirty' | 'wetDirty' | 'dry';
