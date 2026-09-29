import { FieldErrors } from '../auth/auth.models';

/** A new invitation; the web builds the link `/invite/{token}` from it. */
export interface CreatedInvitation {
  token: string;
  expiresAt: string;
}

/** An unused, unexpired, unrevoked invitation. `createdBy` is the creator's display name. */
export interface PendingInvitation {
  id: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

export type CreateInvitationResult =
  { ok: true; invitation: CreatedInvitation } | { ok: false; errors: FieldErrors };

export type PendingInvitationsResult =
  { ok: true; invitations: PendingInvitation[] } | { ok: false; errors: FieldErrors };

export type RevokeInvitationResult = { ok: true } | { ok: false; errors: FieldErrors };
