import { FieldErrors } from '../auth/auth.models';

/** A family member: an enabled, non-deleted account. */
export interface Member {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
}

export type MembersResult = { ok: true; members: Member[] } | { ok: false; errors: FieldErrors };

export type RemoveMemberResult = { ok: true } | { ok: false; errors: FieldErrors };
