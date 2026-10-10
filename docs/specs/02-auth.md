# 02 — Authentication

Status: in progress

## Goal

Let each caregiver have their own account on a self-hosted instance, log in once on their phone and stay logged in, and recover access without depending on external services.

## User stories

- As the person installing Nala, I want to create the first account and my family on a fresh instance so that I become its instance admin.
- As an invited person, I want to open an invitation link and create my account, or use the one I already have, so that I can join a family or create mine.
- As a user, I want to log in with my email and password and stay logged in, so I'm never locked out in the middle of the night.
- As a user who forgot my password, I want to reset it by email (if the instance has email) or with a link from the admin.
- As a user, I want to change my password, my display name and my language, and to log out.
- As a user, I want to delete my account from the app settings, without losing the entries I logged for my families.
- As a family admin deleting my account, I want to be clearly warned that my families and all their data will be deleted.
- As the instance admin, I want to invite people to create their family, see the accounts of the instance and generate a reset link for any of them, without seeing any family's data.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### First-run setup
- [x] When the instance has no user, the app shows a setup screen instead of the login screen.
- [x] Setup creates an account with email, display name and password, and a family with the typed name (03); that account is the instance admin and the family's admin, and is logged in immediately.
- [x] Once any user exists, the setup endpoint is refused (403) and the setup screen is no longer reachable.

### Registration (by invitation only)
- [x] There is no public sign-up once the instance is set up.
- [x] An invitation link is single-use and expires after 7 days.
- [ ] Opening a valid invitation link while signed out shows who invites and to what (join {family}, or create a family) and a registration form (email, display name, password, plus the family name for a new-family invitation), with a way to sign in instead. Submitting it creates the account, joins or creates the family (03), consumes the invitation, and logs the user in.
- [ ] Signing in from an invitation link comes back to it. Opening it while signed in offers to accept it with the current account (asking the family name for a new-family invitation); accepting joins or creates the family (03) and consumes the invitation; Not now leaves it unused.
- [x] An expired, already-used or unknown invitation link shows a clear error and cannot create an account.
- [ ] Registering with an email that already has an account is refused with a clear message, which offers to sign in and accept the invitation instead.
- [x] Emails are case-insensitive and trimmed (`Anna@Mail.com ` = `anna@mail.com`).

### Login and session
- [x] Login with a correct email and password succeeds; a wrong email or wrong password returns the same generic error (no hint about which one is wrong).
- [x] The session is a secure, httpOnly, same-site cookie (no token readable by JavaScript).
- [x] The session is rolling: every use extends it; it expires after 90 days without any use.
- [x] After too many failed logins for the same account (5 in 15 minutes), further attempts are temporarily refused.
- [x] Logout ends the current session only.
- [x] Every API endpoint except health (`GET /api/health`), auth state (`GET /api/auth/state`), setup, login, invitation lookup/registration and password reset requires a valid session (401 otherwise).

### Password rules
- [x] Passwords must be at least 8 characters; no other composition rules.
- [x] Passwords are stored only as a salted slow hash (ASP.NET Core Identity's hasher or equivalent), never in plain text or logs.

### Password reset
- [x] The instance admin can generate a one-time reset link for any user; it expires after 24 hours.
- [x] If SMTP is configured (env variables), the login screen offers "Forgot password", which emails a one-time reset link valid 1 hour.
- [x] If SMTP is not configured, "Forgot password" is hidden and the screen tells the user to ask the admin.
- [x] Requesting a reset by email always shows the same confirmation, whether the email exists or not.
- [x] Using a reset link sets the new password, consumes the link, and ends all other sessions of that user.

### Account settings
- [x] A user can change their display name and preferred language (EN/FR). The language defaults to the browser language on first login, falling back to English.
- [x] A user can change their password by giving the current one; other sessions are ended.
- [x] The bottom of the settings page shows the version: the short hash of the commit the app was built from.

### Account deletion
- [x] A user can delete their own account from the app settings, after confirming with their password.
- [x] Deletion ends all of the user's sessions; the account can no longer log in.
- [x] Deletion removes the user's email and password hash, freeing the email to be invited again. The display name is kept so entries still show who logged them.
- [ ] Deletion ends the user's memberships. Entries logged by the deleted user are not changed or removed, except those of the families they administer, which are deleted with them (03).
- [ ] A family admin deleting their account is first warned, in the confirmation dialog, that the families they administer (each named, with its babies) will be deleted for every member with all their data; confirming deletes them (03).
- [x] The instance admin cannot delete their own account (the instance must always have its admin).

### Instance admin
- [x] The instance has exactly one instance admin: the account created at first-run setup. No other user can be made instance admin.
- [ ] The instance admin can list all accounts (display name, email, last activity), whatever their families; deleted accounts are not listed. The list shows no family data.
- [ ] Only the instance admin can create (link, or by email when SMTP is configured), list and revoke new-family invitations (single-use, 7 days); anyone else is refused (403).
- [ ] There is no account disable: the disable / enable actions and endpoints are gone, and no login or reset link is refused for a disabled account.

### Offline interaction
- Keeping queued entries across a session expiry is specified and tested with the offline queue, in [04 § Offline queue](04-app-layout.md#offline-queue).

## Decisions

- **Email:** trimmed and lower-cased before storing or comparing; valid when it has one `@`, text on both sides, a dot in the domain, no spaces, and at most 254 characters. Same rule in the API (`Nala.Core/Auth/EmailAddress`) and the web form.
- **Display name:** trimmed, 1–50 characters.
- **Validation errors:** the API answers 400 with a validation problem keyed by field, whose values are codes (`required`, `invalid`, `tooShort`, `tooLong`, `taken` for an email that already has an account, and `incorrect` for a wrong current password); the web shows `auth.errors.<field>.<code>`.
- **Session cookie:** `nala.session`, `HttpOnly`, `SameSite=Strict`, always `Secure`, except in the `Development` environment (`dotnet run`), where it follows the request scheme so plain `http://localhost` works in every browser. Logging in therefore needs HTTPS in production (README).
- **Language at setup:** the app sends the language it currently shows (browser language, else English); stored as the user's preferred language.
- **Single instance admin:** an account-level role (`is admin` on the user), separate from the family admin role of 03; enforced in Core (setup refused once any user exists) and by a unique partial index on `is_admin`; a setup losing that race gets 403.
- **Auth state:** `GET /api/auth/state` → `{ setupRequired, user }` (public), used by the web guards to route to setup or login.
- **Server-side sessions:** the cookie only carries the user id and a session id; each session is a row in `sessions`, checked on every request. Deleting the row ends the session (logout, "end other sessions", account deletion). A use extends the session and reissues the cookie (both 90 days from that use); uses less than 1 minute apart don't write, to avoid a database write per request.
- **Login:** `POST /api/auth/login` → 200 with the auth state and the cookie; 400 validation problem for missing fields; 401 `{ code: "invalidCredentials" }` for a wrong email or password (an unknown email still runs the password hasher, so timing doesn't tell them apart); 429 `{ code: "tooManyAttempts" }` while locked. `POST /api/auth/logout` → 204.
- **Lockout:** failures are counted per normalized email, whether or not an account has it, so the lockout doesn't reveal which accounts exist. With 5 failures in the last 15 minutes the attempt is refused without checking the password and isn't counted, so the lock lifts at most 15 minutes after the first failure. A successful login clears the failures. The web shows a distinct "too many attempts" message.
- **Invitation token:** 32 random bytes, base64url, in the link `/invite/{token}`. Only its SHA-256 hash is stored.
- **Invitation lookup:** `GET /api/auth/invitations/{token}` → 200 `{ kind: "join" | "newFamily", invitedBy, familyName, expiresAt }` (`familyName` null for a new-family invitation; the invitation page says who invites them and to what); 404 `{ code: "invitationUnknown" }`; 410 `{ code }` with `invitationExpired`, `invitationUsed` or `invitationRevoked`. Each code has its own message on the register page, with a link to the login screen. An invitation expires exactly at `expires at`.
- **Setup:** the setup form also asks the family name (03, `familyName`: `required` / `tooLong`); the account, the family and its admin membership are created together.
- **Registration:** `POST /api/auth/invitations/{token}/register` with `{ email, displayName, password, language, familyName? }` → 200 with the auth state and the cookie (the new user is signed in, never instance admin); `familyName` is required for a new-family invitation (`required` / `tooLong`, 03) and ignored for a join one. A join invitation makes them a member of its family, a new-family one creates their family with them as its admin (03). The same 404/410 as the lookup; 400 validation problem (`email` `taken` when an account has it: the register page then offers to sign in and accept instead). The invitation is checked before the fields, so an unusable link never tells whether an email has an account. Creating the user, the membership (and family) and consuming the invitation happen in one transaction with a conditional update, so concurrent registrations on one link create a single account. The language is the one the app shows, as at setup.
- **Accepting with an existing account:** `POST /api/auth/invitations/{token}/accept` with `{ familyName? }` (session required) → 200 `{ familyId }`; same 404/410 as the lookup, `familyName` as at registration, 409 `{ code: "alreadyMember" }` when the caller is already in the join invitation's family (the invitation stays unused). Same transaction and conditional update as registration.
- **Invitation page:** `/invite/{token}`. Signed out: who invites them and to what, the registration form (family name field for a new-family invitation) and "Already have an account? Log in", which opens the login screen and comes back to the invitation once signed in. Signed in: an accept card in the shared auth card ("{name} invites you to join {family}" / "{name} invites you to create your family on Nala", with the family name field), Accept and Not now (back to the app, the invitation unused). After accepting, the app opens with that family selected (03). An unusable link shows its error, as before. On an empty instance, the link leads to setup.
- **Authorization:** every endpoint requires a session by default (fallback policy); public endpoints opt out explicitly, and a test pins the list of public endpoints.
- **Account settings:** `PATCH /api/account` with `{ displayName?, language? }` → 200 with the current user; fields left out are unchanged; 400 validation problem (`displayName`: `required`/`tooLong`, `language`: `invalid`), and nothing is saved when a field is invalid. `POST /api/account/password` with `{ currentPassword, newPassword }` → 204; 400 validation problem (`currentPassword`: `required`/`incorrect`, `newPassword`: `required`/`tooShort`). A wrong current password isn't throttled (the caller already has a session). On success every other session of the user is deleted; the current one is kept.
- **Language in the app:** the language stored at setup or registration (the one the app showed: browser language, else English) is the default. Once signed in, the app shows the user's language and follows any change to it; signed-out screens use the browser language. Changing it in settings saves it and switches right away.
- **Settings page:** `/settings` (signed in only) with an Account section (display name, language, change password), an Appearance section (theme light / dark / system, per device), Log out and, at the very bottom, a muted "Version a1b2c3d" line. The web Docker build reads the short hash from the repository's `.git` (compose `additional_contexts`, so the prod host must be a git clone) and passes it to `ng build --define NALA_COMMIT`; outside Docker it shows `dev`. Sections use the shared `nala-settings-section`. Saves are confirmed with a snackbar. Settings is reached from the bottom navigation bar (04).
- **Account deletion:** `DELETE /api/account` with `{ password }` → 204, and this device's cookie is cleared; 400 validation problem (`password`: `required`/`incorrect`, not throttled, as for a password change); 403 `{ code: "adminCannotDelete" }` for the instance admin, checked before the password. It is a soft delete: `deleted at` is set, email and password hash become null (the email can be invited again), and the row keeps its id, display name and language, so everything that references the user (entries, invitations) is untouched. Every session and membership of the user is deleted, and the invitations they created that are still pending are revoked. In the same transaction, every family the user administers is deleted with all its data (03). Each activity spec (05+) adds a test that a deleted user's entries remain.
- **Delete account in settings:** the Account section ends with a Delete account part: a warning and an outlined button opening a confirmation dialog (password field, Cancel / Delete). For a family admin, the dialog first says, as an error-coloured warning, that the families they administer will be deleted for every member with all their babies and entries, and lists each family by name with its babies (from `GET /api/families` and `GET /api/babies`); the button reads "Delete my account and my families". A wrong password shows under the field and the dialog stays open. Once deleted, the app opens the login screen with a snackbar. The instance admin sees a notice that their account can't be deleted instead of the button.
- **Last activity:** set at sign-in (setup, login, registration) and whenever a session use is written (uses at least 1 minute apart, as for the rolling session), so it costs no extra write per request.
- **Admin endpoints:** instance admin only, 403 `{ code: "adminOnly" }` for anyone else (checked in Core). `GET /api/admin/users` → 200 `[{ id, displayName, email, isAdmin, lastActivityAt }]`, non-deleted users only, the instance admin first then by display name (case-insensitive); no family data.
- **New-family invitations:** `POST /api/admin/invitations` → 200 `{ token, expiresAt }`, `POST /api/admin/invitations/email` with `{ email }` → 202 `{ expiresAt }`, `GET /api/admin/invitations` → pending new-family invitations, `POST /api/admin/invitations/{id}/revoke` → 204. Same rules, codes and email sending as 03's join invitations, except: no family (404 `familyNotFound` never applies), no `alreadyMember` check (anyone can create a family, even with an account), and the email says they're invited to create their family on Nala.
- **Instance section in settings:** shown to the instance admin only, between Account and Appearance. First "New families": an "Invite a family" button (link in the shared `nala-share-link-dialog`) and, with `smtpEnabled`, "Invite by email", then the pending new-family invitations (shared `nala-invitation-list-item`, Revoke), as in 03's Members & invitations. Then "Accounts": each user is a shared `nala-member-list-item` (name, email, admin badge) with "Last active …" (date and time in the app's language, "No activity yet" when never signed in).
- **Reset link token:** same scheme as invitations (the shared `Nala.Core/Auth/LinkToken`): 32 random bytes, base64url, only the SHA-256 hash stored. Link: `/reset/{token}`, built by the web from its own origin.
- **Admin reset link:** `POST /api/admin/users/{id}/reset-link` → 200 `{ token, expiresAt }` (24 hours). Errors: 403 `{ code: "adminOnly" }`, 404 `{ code: "userNotFound" }` (unknown or deleted user). Creating a link deletes the user's earlier unused links: only the newest one works. The API allows the admin a link for themselves; the UI doesn't offer it (they use Change password).
- **Reset link lookup:** `GET /api/auth/password-resets/{token}` (public) → 200 `{ email, expiresAt }`; 404 `{ code: "resetLinkUnknown" }` (unknown link, or its user is deleted); 410 `{ code }` with `resetLinkExpired` or `resetLinkUsed`. A link expires exactly at `expires at`.
- **Reset:** `POST /api/auth/password-resets/{token}` (public) with `{ password }` → 200 with the auth state and the cookie: the password is set, the link consumed, every session of the user deleted and their login failures cleared, then this device is signed in. The link is checked before the field; same 404/410 as the lookup; 400 validation problem (`password`: `required`/`tooShort`). The link is consumed by a conditional update, so concurrent resets with one link succeed once.
- **Reset link in the accounts list:** each row but the instance admin's has a ⋮ icon button (`mat-menu`) with Reset link. Reset link opens the shared `nala-share-link-dialog`: the link read-only, its expiry, Copy (snackbar "Link copied") and Share (the device's share sheet, shown only when the browser has one). 03 reuses the dialog for invitation links.
- **Reset password page:** `/reset/{token}`, signed-out visitors only (signed-in ones are sent to the app, as for invitations), in the shared auth card: the account's email, a new password field (and a hidden username field for password managers), or the link's error with a link to the login screen. On success the app opens, signed in.
- **Email settings:** `.env` → compose → API: `NALA_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURITY` (`auto` default, `starttls`, `ssl`, `none`); in the API `Nala__PublicUrl` and `Smtp__*`. SMTP counts as configured when `SMTP_HOST` is set; then `SMTP_FROM` (an email address) and `NALA_PUBLIC_URL` (absolute http(s) URL) are required and the API refuses to start without them, naming the variable. Emailed links are `{NALA_PUBLIC_URL}/reset/{token}`; the request's Host header is never used.
- **Forgot password endpoint:** `POST /api/auth/password-resets` (public) with `{ email }` → 202, no body, whatever the email. 400 validation problem only for its format (`email`: `required`/`invalid`). 404 `{ code: "emailResetDisabled" }` when SMTP isn't configured. Only an existing, non-deleted account gets an email; any other email gets the same 202 and nothing is sent.
- **Emailed link:** same token scheme as the admin link, valid 1 hour, and it replaces the user's earlier unused links (only the newest works, whether emailed or from the admin). At most one email per account every 5 minutes: while the user's newest reset link (any origin, used or not) is younger than that, a request sends nothing (same 202).
- **Sending:** the endpoint queues the email in memory and answers at once, so its timing doesn't tell whether the account exists; a background service sends it with MailKit. A failure is logged (without the body, which holds the link) and not retried; a queued email is lost if the API stops.
- **Reset email:** plain text in the user's language (EN/FR, else English): subject "Reset your Nala password" / "Réinitialiser votre mot de passe Nala", greeting by display name, the link, "works once, for 1 hour", and "ignore this if you didn't ask".
- **Auth state and email:** the auth state (`GET /api/auth/state` and every sign-in response) carries `smtpEnabled`. The web keeps it after signing out.
- **Forgot password in the web:** with `smtpEnabled`, the login card has a "Forgot password?" text button (before Log in) to `/forgot`; without it, a hint says to ask the instance admin for a reset link. `/forgot` (signed-out only, sent to `/login` when SMTP is off) is the shared auth card with an email field, Send the link and Back to login; once sent, the card only shows "If an account exists for {email}, we've sent it a link to set a new password. It works for 1 hour." and Back to login. The emailed link opens the existing reset password page.
- **Icons:** Material Symbols Outlined, bundled with the app (`@fontsource/material-symbols-outlined`, like Roboto), is the default `mat-icon` font set.
- **Web session handling:** a 401 from any API call (except login) forgets the user and opens the login screen. When the auth state can't be loaded (offline), the app shell opens anyway.

## Build slices

Built in 8 slices, all done; each is a commit "Spec 02 slice N: …" (`git log --grep "Spec 02 slice"`). The multi-family changes (unticked criteria above) are built with spec 03's slices.

## Data

- **User:** id, email (unique among non-deleted users, normalized), display name, password hash, preferred language, is admin (instance admin), deleted at, created at, last activity at. Families and memberships: see 03.
- **Session:** id, user, created at, last seen at. Expired 90 days after last seen.
- **Login failure:** normalized email, failed at (lockout window only).
- **Invitation:** id, token (stored hashed), family (null for a new-family invitation, 03), created by user, created at, expires at, used at, used by user, revoked at.
- **Password reset token:** token (stored hashed), user, created at, expires at, used at.

## UI notes

- Screens: first-run setup, login, invitation (register or accept), forgot password, reset password, account settings (incl. delete account), instance section (new-family invitations, accounts list).
- Auth screens share one centered card layout (shared component) usable on a phone.
- All text through i18n (EN/FR).

## Out of scope

- SSO / OpenID Connect, passkeys, two-factor authentication.
- Public sign-up.
- Email verification (emails are trusted as typed; they only matter for login and optional reset emails).
- Join invitations, families and removing members — covered in 03 Family & baby profile. This spec covers new-family invitations (instance admin) and how an invitation link turns into an account or a membership.
- Disabling accounts (removed: a family admin removes a member from their family instead, 03).

## Open questions

None.
