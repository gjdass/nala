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
}

export interface SetupRequest {
  email: string;
  displayName: string;
  password: string;
  language: Lang;
}

/** Field name → error code (`required`, `invalid`, `tooShort`, `tooLong`); `form` for errors not tied to a field. */
export type FieldErrors = Partial<Record<string, string>>;

export type SetupResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResult = { ok: true } | { ok: false; errors: FieldErrors };
