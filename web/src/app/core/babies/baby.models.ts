import { FieldErrors } from '../auth/auth.models';

export type Sex = 'girl' | 'boy' | 'unspecified';

/** A baby of the family. `birthDate` is a calendar date, `yyyy-MM-dd`. */
export interface Baby {
  id: string;
  name: string;
  birthDate: string;
  sex: Sex;
  birthWeightG: number | null;
  birthLengthCm: number | null;
  birthHeadCircumferenceCm: number | null;
}

/** What a member enters to add or edit a baby. */
export type BabyFields = Omit<Baby, 'id'>;

export type BabiesResult = { ok: true; babies: Baby[] } | { ok: false; errors: FieldErrors };

export type BabyResult = { ok: true; baby: Baby } | { ok: false; errors: FieldErrors };
