import { FieldErrors } from '../auth/auth.models';

/** A user as the admin sees them. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  /** ISO date-time; null until the user has signed in once. */
  lastActivityAt: string | null;
}

export type AdminUsersResult =
  { ok: true; users: AdminUser[] } | { ok: false; errors: FieldErrors };

/** A one-time password reset link; the web builds `/reset/{token}` from it. */
export interface ResetLinkToken {
  token: string;
  expiresAt: string;
}

export type ResetLinkResult = { ok: true; link: ResetLinkToken } | { ok: false; errors: FieldErrors };
