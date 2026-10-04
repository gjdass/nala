import { UserName } from '../entries/entry.models';

/** The kinds of growth entry (spec 10); milestones come with slice 2. */
export type GrowthKind = 'measurement';

/** A growth entry as the API returns it (spec 10). */
export interface GrowthEntry {
  id: string;
  babyId: string;
  kind: GrowthKind;
  /** A calendar date, `yyyy-MM-dd`, no time. */
  date: string;
  /** Whole grams; null when not given. */
  weightG: number | null;
  /** At most 1 decimal; null when not given. */
  lengthCm: number | null;
  /** At most 1 decimal; null when not given. */
  headCircumferenceCm: number | null;
  notes: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Measurement sheet sends, to add or to edit; at least one value. */
export interface MeasurementFields {
  /** `yyyy-MM-dd`. */
  date: string;
  weightG: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
  notes: string | null;
}

/** The latest value of a measure (grams for the weight, cm otherwise), its date, and whether it is the birth value. */
export interface LatestMeasure {
  value: number;
  /** `yyyy-MM-dd`. */
  date: string;
  birth: boolean;
}

/** The latest value of each measure of a baby, from an entry or the birth profile; null when it has none. */
export interface GrowthLatest {
  weight: LatestMeasure | null;
  length: LatestMeasure | null;
  headCircumference: LatestMeasure | null;
}
