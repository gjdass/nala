import { FieldErrors } from '../auth/auth.models';

export type Sex = 'girl' | 'boy' | 'unspecified';

/** A baby of one of the user's families; it never changes family. `birthDate` is a calendar date, `yyyy-MM-dd`. */
export interface Baby {
  id: string;
  familyId: string;
  name: string;
  birthDate: string;
  sex: Sex;
  birthWeightG: number | null;
  birthLengthCm: number | null;
  birthHeadCircumferenceCm: number | null;
}

/** What a member enters to add or edit a baby. */
export type BabyFields = Omit<Baby, 'id' | 'familyId'>;

export type BabiesResult = { ok: true; babies: Baby[] } | { ok: false; errors: FieldErrors };

export type BabyResult = { ok: true; baby: Baby } | { ok: false; errors: FieldErrors };

export type BabyDeleteResult = { ok: true } | { ok: false; errors: FieldErrors };

/** What the baby sheet closes with: the added or edited baby, or the id of the deleted one. */
export type BabySheetResult = { saved: Baby } | { deleted: string };
