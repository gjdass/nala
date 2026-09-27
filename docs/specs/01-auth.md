# 01 — Authentication

Status: specified

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
- [ ] When the instance has no user, the app shows a setup screen instead of the login screen.
- [ ] Setup creates an account with email, display name and password; that account is the instance admin and is logged in immediately.
- [ ] Once any user exists, the setup endpoint is refused (403) and the setup screen is no longer reachable.

### Registration (by invitation only)
- [ ] There is no public sign-up once the instance is set up.
- [ ] An invitation link is single-use and expires after 7 days.
- [ ] Opening a valid invitation link shows a registration form (email, display name, password). Submitting it creates the account, consumes the invitation, and logs the user in.
- [ ] An expired, already-used or unknown invitation link shows a clear error and cannot create an account.
- [ ] Registering with an email that already has an account is refused with a clear message.
- [ ] Emails are case-insensitive and trimmed (`Anna@Mail.com ` = `anna@mail.com`).

### Login and session
- [ ] Login with a correct email and password succeeds; a wrong email or wrong password returns the same generic error (no hint about which one is wrong).
- [ ] The session is a secure, httpOnly, same-site cookie (no token readable by JavaScript).
- [ ] The session is rolling: every use extends it; it expires after 90 days without any use.
- [ ] After too many failed logins for the same account (5 in 15 minutes), further attempts are temporarily refused.
- [ ] A disabled account cannot log in, and its existing sessions stop working.
- [ ] Logout ends the current session only.
- [ ] Every API endpoint except setup, login, invitation lookup/registration and password reset requires a valid session (401 otherwise).

### Password rules
- [ ] Passwords must be at least 8 characters; no other composition rules.
- [ ] Passwords are stored only as a salted slow hash (ASP.NET Core Identity's hasher or equivalent), never in plain text or logs.

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
- [ ] If the session has expired while entries are queued offline, the queue is kept on the device; it is sent after the user logs in again, as the same user only.

## Data

- **User:** id, family, email (unique among non-deleted users, normalized), display name, password hash, preferred language, is admin, is disabled, deleted at, created at, last activity at. A user belongs to exactly one family.
- **Session:** handled by the auth cookie; server-side invalidation needed for "end other sessions" and disabled accounts (e.g. security stamp).
- **Invitation:** id, token (stored hashed), created by user, target family, created at, expires at, used at, used by user.
- **Password reset token:** token (stored hashed), user, created at, expires at, used at.

## UI notes

- Screens: first-run setup, login, register from invitation, forgot password, reset password, account settings (incl. delete account), admin users list.
- Auth screens share one centered card layout (shared component) usable on a phone.
- All text through i18n (EN/FR).

## Out of scope

- SSO / OpenID Connect, passkeys, two-factor authentication.
- Public sign-up.
- Email verification (emails are trusted as typed; they only matter for login and optional reset emails).
- Creating and managing families and invitations from inside a family — covered in 02 Family & baby profile. This spec only covers how an invitation link turns into an account.

## Open questions

None.
