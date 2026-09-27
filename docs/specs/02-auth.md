# 02 — Authentication

Status: in progress

## Goal

Let each caregiver have their own account on a self-hosted instance, log in once on their phone and stay logged in, and recover access without depending on external services.

## User stories

- As the person installing Nala, I want to create the first account on a fresh instance so that I become its admin.
- As an invited caregiver, I want to open an invitation link and create my account so that I can join the family.
- As a user, I want to log in with my email and password and stay logged in, so I'm never locked out in the middle of the night.
- As a user who forgot my password, I want to reset it by email (if the instance has email) or with a link from the admin.
- As a user, I want to change my password, my display name and my language, and to log out.
- As a user, I want to delete my account from the app settings, without losing the entries I logged for the family.
- As the admin, I want to see the users of the instance, generate a reset link for any of them, and disable an account.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### First-run setup
- [x] When the instance has no user, the app shows a setup screen instead of the login screen.
- [x] Setup creates an account with email, display name and password; that account is the instance admin and is logged in immediately.
- [x] Once any user exists, the setup endpoint is refused (403) and the setup screen is no longer reachable.

### Registration (by invitation only)
- [x] There is no public sign-up once the instance is set up.
- [x] An invitation link is single-use and expires after 7 days.
- [x] Opening a valid invitation link shows a registration form (email, display name, password). Submitting it creates the account, consumes the invitation, and logs the user in.
- [x] An expired, already-used or unknown invitation link shows a clear error and cannot create an account.
- [x] Registering with an email that already has an account is refused with a clear message.
- [x] Emails are case-insensitive and trimmed (`Anna@Mail.com ` = `anna@mail.com`).

### Login and session
- [x] Login with a correct email and password succeeds; a wrong email or wrong password returns the same generic error (no hint about which one is wrong).
- [x] The session is a secure, httpOnly, same-site cookie (no token readable by JavaScript).
- [x] The session is rolling: every use extends it; it expires after 90 days without any use.
- [x] After too many failed logins for the same account (5 in 15 minutes), further attempts are temporarily refused.
- [ ] A disabled account cannot log in, and its existing sessions stop working.
- [x] Logout ends the current session only.
- [x] Every API endpoint except health (`GET /api/health`), auth state (`GET /api/auth/state`), setup, login, invitation lookup/registration and password reset requires a valid session (401 otherwise).

### Password rules
- [x] Passwords must be at least 8 characters; no other composition rules.
- [x] Passwords are stored only as a salted slow hash (ASP.NET Core Identity's hasher or equivalent), never in plain text or logs.

### Password reset
- [ ] The admin can generate a one-time reset link for any user; it expires after 24 hours.
- [ ] If SMTP is configured (env variables), the login screen offers "Forgot password", which emails a one-time reset link valid 1 hour.
- [ ] If SMTP is not configured, "Forgot password" is hidden and the screen tells the user to ask the admin.
- [ ] Requesting a reset by email always shows the same confirmation, whether the email exists or not.
- [ ] Using a reset link sets the new password, consumes the link, and ends all other sessions of that user.

### Account settings
- [ ] A user can change their display name and preferred language (EN/FR). The language defaults to the browser language on first login, falling back to English.
- [ ] A user can change their password by giving the current one; other sessions are ended.

### Account deletion
- [ ] A user can delete their own account from the app settings, after confirming with their password.
- [ ] Deletion ends all of the user's sessions; the account can no longer log in.
- [ ] Deletion removes the user's email and password hash, freeing the email to be invited again. The display name is kept so entries still show who logged them.
- [ ] Entries logged by the deleted user are not changed or removed.
- [ ] The admin cannot delete their own account (the instance must always have its admin).

### Admin
- [ ] The instance has exactly one admin: the account created at first-run setup. No other user can be made admin.
- [ ] The admin can list all users (display name, email, disabled or not, last activity). Deleted accounts are not listed.
- [ ] The admin can disable and re-enable a user; the admin cannot disable themselves.

### Offline interaction
- Keeping queued entries across a session expiry is specified and tested with the offline queue, in [05 Feed § Offline](05-feed.md#offline).

## Decisions

- **Email:** trimmed and lower-cased before storing or comparing; valid when it has one `@`, text on both sides, a dot in the domain, no spaces, and at most 254 characters. Same rule in the API (`Nala.Core/Auth/EmailAddress`) and the web form.
- **Display name:** trimmed, 1–50 characters.
- **Validation errors:** the API answers 400 with a validation problem keyed by field, whose values are codes (`required`, `invalid`, `tooShort`, `tooLong`, and `taken` for an email that already has an account); the web shows `auth.errors.<field>.<code>`.
- **Session cookie:** `nala.session`, `HttpOnly`, `SameSite=Strict`, always `Secure`, except in the `Development` environment (`dotnet run`), where it follows the request scheme so plain `http://localhost` works in every browser. Logging in therefore needs HTTPS in production (README).
- **Language at setup:** the app sends the language it currently shows (browser language, else English); stored as the user's preferred language.
- **Single admin:** enforced in Core (setup refused once any user exists) and by a unique partial index on `is_admin`; a setup losing that race gets 403.
- **Auth state:** `GET /api/auth/state` → `{ setupRequired, user }` (public), used by the web guards to route to setup or login.
- **Server-side sessions:** the cookie only carries the user id and a session id; each session is a row in `sessions`, checked on every request. Deleting the row ends the session (logout, "end other sessions", disabled accounts). A use extends the session and reissues the cookie (both 90 days from that use); uses less than 1 minute apart don't write, to avoid a database write per request.
- **Login:** `POST /api/auth/login` → 200 with the auth state and the cookie; 400 validation problem for missing fields; 401 `{ code: "invalidCredentials" }` for a wrong email or password (an unknown email still runs the password hasher, so timing doesn't tell them apart); 429 `{ code: "tooManyAttempts" }` while locked. `POST /api/auth/logout` → 204.
- **Lockout:** failures are counted per normalized email, whether or not an account has it, so the lockout doesn't reveal which accounts exist. With 5 failures in the last 15 minutes the attempt is refused without checking the password and isn't counted, so the lock lifts at most 15 minutes after the first failure. A successful login clears the failures. The web shows a distinct "too many attempts" message.
- **Invitation token:** 32 random bytes, base64url, in the link `/invite/{token}`. Only its SHA-256 hash is stored.
- **Invitation lookup:** `GET /api/auth/invitations/{token}` → 200 `{ invitedBy, expiresAt }` (the register page says who invited them); 404 `{ code: "invitationUnknown" }`; 410 `{ code }` with `invitationExpired`, `invitationUsed` or `invitationRevoked`. Each code has its own message on the register page, with a link to the login screen. An invitation expires exactly at `expires at`.
- **Registration:** `POST /api/auth/invitations/{token}/register` with `{ email, displayName, password, language }` → 200 with the auth state and the cookie (the new member is signed in, never admin); the same 404/410 as the lookup; 400 validation problem. The invitation is checked before the fields, so an unusable link never tells whether an email has an account. Creating the user and consuming the invitation happen in one transaction with a conditional update, so concurrent registrations on one link create a single account. The language is the one the app shows, as at setup.
- **Signed-in visitors** opening an invitation link are sent to the app; the invitation stays unused. On an empty instance, the link leads to setup.
- **Authorization:** every endpoint requires a session by default (fallback policy); public endpoints opt out explicitly, and a test pins the list of public endpoints.
- **Web session handling:** a 401 from any API call (except login) forgets the user and opens the login screen. When the auth state can't be loaded (offline), the app shell opens anyway.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — First-run setup.** `User` entity + migration (normalized email, unique among non-deleted users), password hasher behind a Core interface (Identity's `PasswordHasher`), 8-character minimum, `GET /api/auth/state`, `POST /api/auth/setup` (creates the admin and signs them in; 403 once any user exists). Web: shared auth card layout, setup page, guard routing to/away from setup. Covers: all First-run setup criteria, email normalization, both Password rules, the "admin = setup account" part of Admin.
- [x] **Slice 2 — Login, session, logout.** Login with a generic error, secure httpOnly same-site cookie backed by server-side sessions, 90-day rolling expiry, lockout after 5 failures in 15 minutes, logout of the current session only, every endpoint requires a session except the public ones (401). Web: login page, auth guard, 401 interceptor. Covers: Login and session criteria except the disabled account one (slice 6).
- [x] **Slice 3 — Registration by invitation.** `Invitation` entity + migration (hashed token, 7-day expiry, used, revoked), invitation lookup, registration consuming the invitation and logging in, duplicate email refused, no public sign-up. Web: register page with clear errors for expired / used / unknown links. Invitations are created in 03; tests seed them. Covers: all Registration criteria.
- [ ] **Slice 4 — Account settings.** Get/update the current user (display name, language; language defaults to the browser's on first login), change password with the current one (ends other sessions). Web: settings page with the Account section (and the theme choice), logout. Covers: both Account settings criteria.
- [ ] **Slice 5 — Account deletion.** Delete own account after confirming the password: ends all sessions, clears email and password hash, keeps the display name, refused for the admin; no cascade to entries. Web: delete action with confirmation dialog. Covers: all Account deletion criteria.
- [ ] **Slice 6 — Admin: users list, disable / re-enable.** Admin-only users list (deleted excluded), disable / re-enable (not self); disabling ends sessions and blocks login. Web: Admin section in settings, admin only. Covers: all Admin criteria, and the disabled account criterion.
- [ ] **Slice 7 — Admin reset link.** `PasswordResetToken` entity + migration (hashed token), admin generates a one-time link valid 24 hours, reset sets the password, consumes the link and ends other sessions. Web: reset-link action in the admin list, reset-password page. Covers: the admin reset link criterion and the "using a reset link" criterion.
- [ ] **Slice 8 — Forgot password by email.** SMTP and public base URL env variables (`.env.example`), `smtpEnabled` in the auth state, forgot-password endpoint with an identical confirmation whatever the email, emailed one-time link valid 1 hour. Web: "Forgot password" when SMTP is configured, "ask your admin" otherwise. Covers: the three SMTP reset criteria.

## Data

- **User:** id, email (unique among non-deleted users, normalized), display name, password hash, preferred language, is admin, is disabled, deleted at, created at, last activity at. The instance is the family (see 03), so there is no family reference.
- **Session:** id, user, created at, last seen at. Expired 90 days after last seen.
- **Login failure:** normalized email, failed at (lockout window only).
- **Invitation:** id, token (stored hashed), created by user, created at, expires at, used at, used by user, revoked at.
- **Password reset token:** token (stored hashed), user, created at, expires at, used at.

## UI notes

- Screens: first-run setup, login, register from invitation, forgot password, reset password, account settings (incl. delete account), admin users list.
- Auth screens share one centered card layout (shared component) usable on a phone.
- All text through i18n (EN/FR).

## Out of scope

- SSO / OpenID Connect, passkeys, two-factor authentication.
- Public sign-up.
- Email verification (emails are trusted as typed; they only matter for login and optional reset emails).
- Creating, listing and revoking invitations, and removing members — covered in 03 Family & baby profile. This spec only covers how an invitation link turns into an account.

## Open questions

None.
