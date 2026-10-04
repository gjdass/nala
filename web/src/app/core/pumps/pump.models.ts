import { UserName } from '../entries/entry.models';

/** A pumping session as the API returns it (spec 08). */
export interface Pump {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  startTime: string;
  /** ISO date-time (UTC); null while the session is live. */
  endTime: string | null;
  /** Millilitres from the left breast; null when not recorded, 0 when that side gave nothing. */
  leftMl: number | null;
  /** Millilitres from the right breast; null when not recorded, 0 when that side gave nothing. */
  rightMl: number | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Pump sheet sends, to add or to edit. */
export interface PumpFields {
  startTime: string;
  /** Null for a live session, which keeps running. */
  endTime: string | null;
  leftMl: number | null;
  rightMl: number | null;
  notes: string | null;
}

/** The volume each side may have, in ml (spec 08). */
export const PUMP_VOLUME_MAX_ML = 500;
