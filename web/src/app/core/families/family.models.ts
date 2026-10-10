import { FieldErrors } from '../auth/auth.models';

/** A family of the signed-in user; `isAdmin`: they are its family admin. */
export interface Family {
  id: string;
  name: string;
  isAdmin: boolean;
}

export type FamiliesResult = { ok: true; families: Family[] } | { ok: false; errors: FieldErrors };

export type FamilyResult = { ok: true; family: Family } | { ok: false; errors: FieldErrors };
