# 02 — Authentication

Status: done

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
- [x] A disabled account cannot log in, and its existing sessions stop working.
- [x] Logout ends the current session only.
- [x] Every API endpoint except health (`GET /api/health`), auth state (`GET /api/auth/state`), setup, login, invitation lookup/registration and password reset requires a valid session (401 otherwise).

### Password rules
- [x] Passwords must be at least 8 characters; no other composition rules.
- [x] Passwords are stored only as a salted slow hash (ASP.NET Core Identity's hasher or equivalent), never in plain text or logs.

### Password reset
- [x] The admin can generate a one-time reset link for any user; it expires after 24 hours.
- [x] If SMTP is configured (env variables), the login screen offers "Forgot password", which emails a one-time reset link valid 1 hour.
- [x] If SMTP is not configured, "Forgot password" is hidden and the screen tells the user to ask the admin.
- [x] Requesting a reset by email always shows the same confirmation, whether the email exists or not.
- [x] Using a reset link sets the new password, consumes the link, and ends all other sessions of that user.

### Account settings
- [x] A user can change their display name and preferred language (EN/FR). The language defaults to the browser language on first login, falling back to English.
- [x] A user can change their password by giving the current one; other sessions are ended.

### Account deletion
- [x] A user can delete their own account from the app settings, after confirming with their password.
- [x] Deletion ends all of the user's sessions; the account can no longer log in.
- [x] Deletion removes the user's email and password hash, freeing the email to be invited again. The display name is kept so entries still show who logged them.
- [x] Entries logged by the deleted user are not changed or removed.
- [x] The admin cannot delete their own account (the instance must always have its admin).

### Admin
- [x] The instance has exactly one admin: the account created at first-run setup. No other user can be made admin.
- [x] The admin can list all users (display name, email, disabled or not, last activity). Deleted accounts are not listed.
- [x] The admin can disable and re-enable a user; the admin cannot disable themselves.

### Offline interaction
- Keeping queued entries across a session expiry is specified and tested with the offline queue, in [05 Feed § Offline](05-feed.md#offline).

## Decisions

- **Email:** trimmed and lower-cased before storing or comparing; valid when it has one `@`, text on both sides, a dot in the domain, no spaces, and at most 254 characters. Same rule in the API (`Nala.Core/Auth/EmailAddress`) and the web form.
- **Display name:** trimmed, 1–50 characters.
- **Validation errors:** the API answers 400 with a validation problem keyed by field, whose values are codes (`required`, `invalid`, `tooShort`, `tooLong`, `taken` for an email that already has an account, and `incorrect` for a wrong current password); the web shows `auth.errors.<field>.<code>`.
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
- **Account settings:** `PATCH /api/account` with `{ displayName?, language? }` → 200 with the current user; fields left out are unchanged; 400 validation problem (`displayName`: `required`/`tooLong`, `language`: `invalid`), and nothing is saved when a field is invalid. `POST /api/account/password` with `{ currentPassword, newPassword }` → 204; 400 validation problem (`currentPassword`: `required`/`incorrect`, `newPassword`: `required`/`tooShort`). A wrong current password isn't throttled (the caller already has a session). On success every other session of the user is deleted; the current one is kept.
- **Language in the app:** the language stored at setup or registration (the one the app showed: browser language, else English) is the default. Once signed in, the app shows the user's language and follows any change to it; signed-out screens use the browser language. Changing it in settings saves it and switches right away.
- **Settings page:** `/settings` (signed in only) with an Account section (display name, language, change password), an Appearance section (theme light / dark / system, per device) and Log out. Sections use the shared `nala-settings-section`. Saves are confirmed with a snackbar. Until the top app bar exists (04), home links to it with a text button.
- **Account deletion:** `DELETE /api/account` with `{ password }` → 204, and this device's cookie is cleared; 400 validation problem (`password`: `required`/`incorrect`, not throttled, as for a password change); 403 `{ code: "adminCannotDelete" }` for the admin, checked before the password. It is a soft delete: `deleted at` is set, email and password hash become null (the email can be invited again), and the row keeps its id, display name and language, so everything that references the user (entries, invitations) is untouched. Every session of the user is deleted, and the invitations they created that are still pending are revoked. Each activity spec (05+) adds a test that a deleted user's entries remain.
- **Delete account in settings:** the Account section ends with a Delete account part: a warning and an outlined button opening a confirmation dialog (password field, Cancel / Delete). A wrong password shows under the field and the dialog stays open. Once deleted, the app opens the login screen with a snackbar. The admin sees a notice that their account can't be deleted instead of the button.
- **Disabled account at login:** with the right password, `POST /api/auth/login` answers 403 `{ code: "accountDisabled" }` (checked only after the password, so it tells nothing to someone without it; not counted as a failure); with a wrong password, the usual 401 `invalidCredentials`. The login screen says the account is disabled and to ask the admin. A disabled user's session is rejected (and deleted) on its next use.
- **Last activity:** set at sign-in (setup, login, registration) and whenever a session use is written (uses at least 1 minute apart, as for the rolling session), so it costs no extra write per request.
- **Admin endpoints:** `GET /api/admin/users` → 200 `[{ id, displayName, email, isAdmin, isDisabled, lastActivityAt }]`, non-deleted users only (disabled included), the admin first then by display name (case-insensitive). `POST /api/admin/users/{id}/disable` and `/enable` → 200 with the updated user; idempotent; disabling deletes every session of the user. Errors: 403 `{ code: "adminOnly" }` for anyone but the admin (checked in Core), 403 `{ code: "adminCannotDisable" }` when the target is the admin, 404 `{ code: "userNotFound" }` for an unknown or deleted user.
- **Admin section in settings:** shown to the admin only, between Account and Appearance. Each user is a shared `nala-member-list-item` (name, email, admin badge) with "Disabled" and "Last active …" (date and time in the app's language, "No activity yet" when never signed in), and a Disable / Enable text button (none on the admin's row). Disable asks for confirmation in the shared `nala-confirm-dialog`; Enable is immediate; both are confirmed with a snackbar.
- **Reset link token:** same scheme as invitations (the shared `Nala.Core/Auth/LinkToken`): 32 random bytes, base64url, only the SHA-256 hash stored. Link: `/reset/{token}`, built by the web from its own origin.
- **Admin reset link:** `POST /api/admin/users/{id}/reset-link` → 200 `{ token, expiresAt }` (24 hours). Errors: 403 `{ code: "adminOnly" }`, 404 `{ code: "userNotFound" }` (unknown or deleted user), 403 `{ code: "accountDisabled" }` (a disabled user gets no link). Creating a link deletes the user's earlier unused links: only the newest one works. The API allows the admin a link for themselves; the UI doesn't offer it (they use Change password).
- **Reset link lookup:** `GET /api/auth/password-resets/{token}` (public) → 200 `{ email, expiresAt }`; 404 `{ code: "resetLinkUnknown" }` (unknown link, or its user is deleted); 410 `{ code }` with `resetLinkExpired` or `resetLinkUsed`; 403 `{ code: "accountDisabled" }` when the user was disabled since. A link expires exactly at `expires at`.
- **Reset:** `POST /api/auth/password-resets/{token}` (public) with `{ password }` → 200 with the auth state and the cookie: the password is set, the link consumed, every session of the user deleted and their login failures cleared, then this device is signed in. The link is checked before the field; same 404/410/403 as the lookup; 400 validation problem (`password`: `required`/`tooShort`). The link is consumed by a conditional update, so concurrent resets with one link succeed once.
- **Reset link in the admin list:** each row but the admin's has a ⋮ icon button (`mat-menu`) with Reset link (enabled users only) and Disable / Enable. Reset link opens the shared `nala-share-link-dialog`: the link read-only, its expiry, Copy (snackbar "Link copied") and Share (the device's share sheet, shown only when the browser has one). 03 reuses the dialog for invitation links.
- **Reset password page:** `/reset/{token}`, signed-out visitors only (signed-in ones are sent to the app, as for invitations), in the shared auth card: the account's email, a new password field (and a hidden username field for password managers), or the link's error with a link to the login screen. On success the app opens, signed in.
- **Email settings:** `.env` → compose → API: `NALA_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURITY` (`auto` default, `starttls`, `ssl`, `none`); in the API `Nala__PublicUrl` and `Smtp__*`. SMTP counts as configured when `SMTP_HOST` is set; then `SMTP_FROM` (an email address) and `NALA_PUBLIC_URL` (absolute http(s) URL) are required and the API refuses to start without them, naming the variable. Emailed links are `{NALA_PUBLIC_URL}/reset/{token}`; the request's Host header is never used.
- **Forgot password endpoint:** `POST /api/auth/password-resets` (public) with `{ email }` → 202, no body, whatever the email. 400 validation problem only for its format (`email`: `required`/`invalid`). 404 `{ code: "emailResetDisabled" }` when SMTP isn't configured. Only an existing, enabled, non-deleted account gets an email; any other email gets the same 202 and nothing is sent.
- **Emailed link:** same token scheme as the admin link, valid 1 hour, and it replaces the user's earlier unused links (only the newest works, whether emailed or from the admin). At most one email per account every 5 minutes: while the user's newest reset link (any origin, used or not) is younger than that, a request sends nothing (same 202).
- **Sending:** the endpoint queues the email in memory and answers at once, so its timing doesn't tell whether the account exists; a background service sends it with MailKit. A failure is logged (without the body, which holds the link) and not retried; a queued email is lost if the API stops.
- **Reset email:** plain text in the user's language (EN/FR, else English): subject "Reset your Nala password" / "Réinitialiser votre mot de passe Nala", greeting by display name, the link, "works once, for 1 hour", and "ignore this if you didn't ask".
- **Auth state and email:** the auth state (`GET /api/auth/state` and every sign-in response) carries `smtpEnabled`. The web keeps it after signing out.
- **Forgot password in the web:** with `smtpEnabled`, the login card has a "Forgot password?" text button (before Log in) to `/forgot`; without it, a hint says to ask the family's admin for a reset link. `/forgot` (signed-out only, sent to `/login` when SMTP is off) is the shared auth card with an email field, Send the link and Back to login; once sent, the card only shows "If an account exists for {email}, we've sent it a link to set a new password. It works for 1 hour." and Back to login. The emailed link opens the existing reset password page.
- **Icons:** Material Symbols Outlined, bundled with the app (`@fontsource/material-symbols-outlined`, like Roboto), is the default `mat-icon` font set.
- **Web session handling:** a 401 from any API call (except login) forgets the user and opens the login screen. When the auth state can't be loaded (offline), the app shell opens anyway.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — First-run setup.** `User` entity + migration (normalized email, unique among non-deleted users), password hasher behind a Core interface (Identity's `PasswordHasher`), 8-character minimum, `GET /api/auth/state`, `POST /api/auth/setup` (creates the admin and signs them in; 403 once any user exists). Web: shared auth card layout, setup page, guard routing to/away from setup. Covers: all First-run setup criteria, email normalization, both Password rules, the "admin = setup account" part of Admin.
- [x] **Slice 2 — Login, session, logout.** Login with a generic error, secure httpOnly same-site cookie backed by server-side sessions, 90-day rolling expiry, lockout after 5 failures in 15 minutes, logout of the current session only, every endpoint requires a session except the public ones (401). Web: login page, auth guard, 401 interceptor. Covers: Login and session criteria except the disabled account one (slice 6).
- [x] **Slice 3 — Registration by invitation.** `Invitation` entity + migration (hashed token, 7-day expiry, used, revoked), invitation lookup, registration consuming the invitation and logging in, duplicate email refused, no public sign-up. Web: register page with clear errors for expired / used / unknown links. Invitations are created in 03; tests seed them. Covers: all Registration criteria.
- [x] **Slice 4 — Account settings.** Get/update the current user (display name, language; language defaults to the browser's on first login), change password with the current one (ends other sessions). Web: settings page with the Account section (and the theme choice), logout. Covers: both Account settings criteria.
- [x] **Slice 5 — Account deletion.** Delete own account after confirming the password: ends all sessions, clears email and password hash, keeps the display name, revokes their pending invitations, refused for the admin; no cascade to entries. Web: delete action with confirmation dialog. Covers: all Account deletion criteria.
- [x] **Slice 6 — Admin: users list, disable / re-enable.** Admin-only users list (deleted excluded), disable / re-enable (not self); disabling ends sessions and blocks login. Web: Admin section in settings, admin only. Covers: all Admin criteria, and the disabled account criterion.
- [x] **Slice 7 — Admin reset link.** `PasswordResetToken` entity + migration (hashed token), admin generates a one-time link valid 24 hours, reset sets the password, consumes the link and ends other sessions. Web: reset-link action in the admin list, reset-password page. Covers: the admin reset link criterion and the "using a reset link" criterion.
- [x] **Slice 8 — Forgot password by email.** SMTP and public base URL env variables (`.env.example`), `smtpEnabled` in the auth state, forgot-password endpoint with an identical confirmation whatever the email, emailed one-time link valid 1 hour. Web: "Forgot password" when SMTP is configured, "ask your admin" otherwise. Covers: the three SMTP reset criteria.

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
