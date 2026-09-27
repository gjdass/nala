import { FieldErrors } from '../auth/auth.models';

/** A user as the admin sees them. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isDisabled: boolean;
  /** ISO date-time; null until the user has signed in once. */
  lastActivityAt: string | null;
}

export type AdminUsersResult =
  { ok: true; users: AdminUser[] } | { ok: false; errors: FieldErrors };

export type AdminUserResult = { ok: true; user: AdminUser } | { ok: false; errors: FieldErrors };
