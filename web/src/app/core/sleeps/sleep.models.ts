import { UserName } from '../entries/entry.models';

/** A sleep as the API returns it (spec 06). */
export interface Sleep {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  startTime: string;
  /** ISO date-time (UTC); null while the sleep is live. */
  endTime: string | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Sleep sheet sends, to add or to edit. */
export interface SleepFields {
  startTime: string;
  endTime: string;
  notes: string | null;
}
