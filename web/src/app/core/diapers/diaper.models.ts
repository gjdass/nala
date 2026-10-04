import { UserName } from '../entries/entry.models';

/** A diaper change as the API returns it (spec 07); neither wet nor dirty is a dry diaper. */
export interface Diaper {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  time: string;
  wet: boolean;
  dirty: boolean;
  rash: boolean;
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
  notes: string | null;
}

/** A diaper's type, derived from its wet and dirty toggles, as a translation key suffix (`diaper.type.`). */
export type DiaperType = 'wet' | 'dirty' | 'wetDirty' | 'dry';
