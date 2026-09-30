import { FieldErrors } from '../auth/auth.models';

export type FeedKind = 'bottle' | 'breastfeed' | 'solids';

export type MilkType = 'breastMilk' | 'formula';

export const MILK_TYPES: readonly MilkType[] = ['breastMilk', 'formula'];

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type SolidsReaction = 'liked' | 'neutral' | 'disliked' | 'allergicReaction';

export const SOLIDS_REACTIONS: readonly SolidsReaction[] = [
  'liked',
  'neutral',
  'disliked',
  'allergicReaction',
];

export type BreastSide = 'left' | 'right';

export const BREAST_SIDES: readonly BreastSide[] = ['left', 'right'];

/** One timed stretch of a breastfeed on one side; `endedAt` is null while that side runs. */
export interface BreastFeedSegment {
  id: string;
  side: BreastSide;
  /** ISO date-time (UTC). */
  startedAt: string;
  endedAt: string | null;
}

/** A user as shown on an entry; a deleted account keeps its display name. */
export interface UserName {
  id: string;
  displayName: string;
}

/** A feed as the API returns it (spec 05); the fields of the other kinds are null. */
export interface Feed {
  id: string;
  babyId: string;
  kind: FeedKind;
  /** ISO date-time (UTC). */
  startTime: string;
  endTime: string | null;
  notes: string | null;
  milkType: MilkType | null;
  amountMl: number | null;
  mealType: MealType | null;
  food: string | null;
  reaction: SolidsReaction | null;
  /** Breastfeed only (empty otherwise), oldest first. */
  segments: readonly BreastFeedSegment[];
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What the Bottle sheet sends, to add or to edit. */
export interface BottleFields {
  startTime: string;
  milkType: MilkType;
  amountMl: number;
  notes: string | null;
}

/** What the Solids sheet sends, to add or to edit. */
export interface SolidsFields {
  startTime: string;
  mealType: MealType | null;
  food: string;
  reaction: SolidsReaction | null;
  notes: string | null;
}

/** A breastfeed's durations typed by hand, in whole seconds, and the side it ended on. */
export interface BreastfeedDurations {
  leftSeconds: number;
  rightSeconds: number;
  endedOn: BreastSide;
}

/**
 * What the Breastfeed sheet sends when saving or editing: the timings come from its timers, or from
 * `durations` when typed by hand (required to add one).
 */
export interface BreastfeedFields {
  startTime: string;
  notes: string | null;
  durations?: BreastfeedDurations;
}

/** The fields each kind sends. */
export interface FeedFieldsByKind {
  bottle: BottleFields;
  breastfeed: BreastfeedFields;
  solids: SolidsFields;
}

/** The baby's breastfeed in progress (null when none) and the side the latest saved one ended on. */
export interface BreastfeedState {
  inProgress: Feed | null;
  lastSide: BreastSide | null;
}

export const NO_BREASTFEED_STATE: BreastfeedState = { inProgress: null, lastSide: null };

/** The milk type of the baby's latest bottle, and the last amount of each milk type. */
export interface BottleDefaults {
  milkType: MilkType | null;
  lastAmountMl: Record<MilkType, number | null>;
}

export const NO_BOTTLE_DEFAULTS: BottleDefaults = {
  milkType: null,
  lastAmountMl: { breastMilk: null, formula: null },
};

export type FeedResult = { ok: true; feed: Feed } | { ok: false; errors: FieldErrors };

export type FeedDeleteResult = { ok: true } | { ok: false; errors: FieldErrors };
