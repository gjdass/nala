import { UserName } from '../entries/entry.models';

/** The units of a dose's amount (spec 09). */
export const DOSE_UNITS = ['ml', 'mg', 'drops', 'dose'] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

/** A health entry as the API returns it (spec 09). */
export interface HealthEntry {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  time: string;
  name: string;
  /** 0.01 to 1000, at most 2 decimals; null when not given. */
  amount: number | null;
  /** Only with an amount; null otherwise. */
  unit: DoseUnit | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Health sheet sends, to add or to edit. */
export interface HealthEntryFields {
  time: string;
  name: string;
  amount: number | null;
  /** Sent as null without an amount. */
  unit: DoseUnit | null;
  notes: string | null;
}

/** A recently given name with the dose of its latest entry (spec 09); no dose when that entry had none. */
export interface RecentMedicine {
  name: string;
  amount: number | null;
  unit: DoseUnit | null;
}
