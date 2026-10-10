import { FieldErrors } from '../auth/auth.models';

/** A member of a family; `isAdmin`: they are its family admin. */
export interface Member {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
}

export type MembersResult = { ok: true; members: Member[] } | { ok: false; errors: FieldErrors };

export type RemoveMemberResult = { ok: true } | { ok: false; errors: FieldErrors };
