import { UserName } from '../entries/entry.models';

/** The units of a dose's amount (spec 09). */
export const MEDICATION_UNITS = ['ml', 'mg', 'drops', 'dose'] as const;
export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

/** A medication dose as the API returns it (spec 09). */
export interface Medication {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  time: string;
  name: string;
  /** 0.01 to 1000, at most 2 decimals; null when not given. */
  amount: number | null;
  /** Only with an amount; null otherwise. */
  unit: MedicationUnit | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Medication sheet sends, to add or to edit. */
export interface MedicationFields {
  time: string;
  name: string;
  amount: number | null;
  /** Sent as null without an amount. */
  unit: MedicationUnit | null;
  notes: string | null;
}
