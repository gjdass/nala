import { FieldErrors } from '../auth/auth.models';

export type FeedKind = 'bottle' | 'solids';

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

/** The fields each kind sends. */
export interface FeedFieldsByKind {
  bottle: BottleFields;
  solids: SolidsFields;
}

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
