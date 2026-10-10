import { Lang } from '../i18n/initial-lang';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  language: Lang;
  isAdmin: boolean;
}

export interface AuthState {
  /** True while the instance has no user: the first visitor creates the admin. */
  setupRequired: boolean;
  user: CurrentUser | null;
  /** The instance can email reset links: the login screen offers "Forgot password". */
  smtpEnabled: boolean;
}

export interface SetupRequest {
  email: string;
  displayName: string;
  password: string;
  language: Lang;
  /** The instance's first family, administered by the new account. */
  familyName: string;
}

/** Field name → error code (`required`, `invalid`, `tooShort`, `tooLong`); `form` for errors not tied to a field. */
export type FieldErrors = Partial<Record<string, string>>;

export type SetupResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface Invitation {
  /** Display name of the member who created the invitation. */
  invitedBy: string;
  expiresAt: string;
}

/** `code`: `invitationUnknown`, `invitationExpired`, `invitationUsed`, `invitationRevoked` or `unknown`. */
export type InvitationLookup = { ok: true; invitation: Invitation } | { ok: false; code: string };

/** The same account fields as setup, sent to an invitation. */
export type RegisterRequest = Omit<SetupRequest, 'familyName'>;

export type RegisterResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface ResetLink {
  /** The account whose password the link resets. */
  email: string;
  expiresAt: string;
}

/** `code`: `resetLinkUnknown`, `resetLinkExpired`, `resetLinkUsed`, `accountDisabled` or `unknown`. */
export type ResetLinkLookup = { ok: true; link: ResetLink } | { ok: false; code: string };

export interface ForgotPasswordRequest {
  email: string;
}

/** Ok whether or not the email has an account: the answer never tells. */
export type ForgotPasswordResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface ResetPasswordRequest {
  password: string;
}

export type ResetPasswordResult = { ok: true } | { ok: false; errors: FieldErrors };

/** Fields left out are unchanged. */
export interface UpdateAccountRequest {
  displayName?: string;
  language?: Lang;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
}

export type AccountResult = { ok: true } | { ok: false; errors: FieldErrors };
