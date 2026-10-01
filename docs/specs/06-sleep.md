# 06 — Sleep

Status: in progress

Layout vocabulary (section card, entry sheet, timers, mini-bar…) is defined in [04 — App layout](04-app-layout.md). The timer rules (live or not, Save never starts or stops a timer, ×) are spec 04's **Timers** rules; this spec only adds what is specific to Sleep.

## Goal

Log the selected baby's sleeps with a single Start / Stop timer, or by typing a start and end time afterwards, and see at a glance how long the baby has been awake.

## Decisions

- **One kind, no categories.** A sleep is a sleep: no nap / night distinction, no location, no "how they fell asleep". A sleep has a start time, an end time and notes, nothing else. Section icon and kind icon: `bedtime`. With one kind, + opens the Sleep sheet directly (spec 04).
- **One timer.** The Sleep sheet has a single timer (duration + Start / Stop button). It follows spec 04's Timers rules: a sleep is **live** while its timer runs and an ordinary sleep otherwise.
- **No segments.** A sleep is only a start time and an end time. Start on a stopped sleep (from its sheet) makes it live again by clearing its end time, so the duration runs from the original start time again (the baby woke briefly and went back to sleep). Unlike Breastfeed, there is nothing per side to keep.
- **Typed times, not a typed duration.** A past sleep is logged with a Start time row and an End time row (date + time, shared `nala-time-row`). The duration is end − start, shown read-only.
- **Sleep endpoints:** `POST /api/sleeps` with `{ id, babyId, startTime, endTime, notes }` creates a stopped sleep (`endTime` required) → 201; sending an existing id again → 200 with the stored sleep unchanged (idempotent re-send). `PUT /api/sleeps/{id}` with `{ startTime, endTime, notes }` → 200: on a stopped sleep it replaces all three; on a live sleep it replaces the start time and notes, `endTime` must be null and the sleep stays live. `DELETE /api/sleeps/{id}` → 204; `GET /api/sleeps/{id}` → 200; unknown sleep → 404 `{ code: "sleepNotFound" }`. `GET /api/babies/{babyId}/sleeps?cursor=&limit=` → `{ entries, next }`, newest first (start time, then id), 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. Unknown baby → 404 `{ code: "babyNotFound" }`. Each sleep carries `endTime` (null while live), `loggedBy` and `updatedBy` (`{ id, displayName }`).
- **Timer endpoints** (each with the client's time `at`, so a queued tap can be replayed): `POST /api/sleeps/{id}/start` `{ babyId, at, queued? }`: an unknown id creates a live sleep (start time = `at`) → 201; a stopped sleep becomes live again (end time cleared) → 200; a live one is unchanged → 200. Making a sleep live while another sleep of the baby is live → 409 `{ code: "sleepInProgress" }` (the sheet then opens that one), unless `queued: true` (sent from a device's offline queue): it is made live anyway, so a sleep logged offline is kept as a separate sleep. `POST /api/sleeps/{id}/stop` `{ at }` sets the end time to `at` (already stopped → 200 unchanged). `GET /api/sleeps/in-progress` → every baby's live sleep, oldest start first (for live sync).
- **Validation codes:** `id` / `babyId` `required`, `startTime` `required` / `inFuture` (1 min tolerance), `endTime` `required` (POST) / `inFuture` / `beforeStart` (not after the start: a 0-minute sleep is refused too), `endTime` `notAllowed` (PUT with an end time on a live sleep), `at` `required` / `inFuture` / `invalid` (a Stop, or a Start making a stopped sleep live again, before its start time), `notes` `tooLong` (spec 04, 1000).
- **One live sleep per baby**, enforced by the service (not a unique index), with the queued exception above. With two live, the card, the timer button and + show the oldest; the mini-bar lists both (spec 04).
- **Adding by hand:** the sheet opens with the start time at now and no end time ("Add"); tapping End time sets it to now and opens its pickers (shared `nala-time-row`, which does this for any empty time row), then either time can be adjusted.
- **Manual mode in the sheet:** typing an End time on a sleep that isn't live disables Start until Save or ×. On a live sleep the End time row reads "Sleeping…" and can't be edited; Stop ends it.
- **Save and ×** follow spec 04: Save sends the start time, end time and notes (`PUT`, or `POST` for a sleep that only exists in the sheet, typed by hand) and never starts or stops the timer. × on a sheet opened to add, once Start created the sleep, asks to discard and deletes it. × on an existing sleep discards the form edits only; when its timer was tapped in the sheet, the sheet closes with the sleep as the taps left it, so the card and history show it.
- **Card highlight:** "Awake for" (FR "Temps d'éveil") with the time since the **end** of the most recent sleep that isn't live (the one that ended last among the card's loaded entries; no separate endpoint), in spec 04's duration format, refreshed every second ("1h 20m", "45m 10s"); on the right, in an M3 display/headline typescale, that sleep's duration, labelled "last sleep". With no sleep at all: an empty state.
- **Running state (while live):** the highlight is replaced by "Sleeping" with the live duration and a Stop button; tapping elsewhere on it opens the sheet. + is the timer button (spec 04). The mini-bar row reads "Sleeping" with the live duration.
- **"Still sleeping?"** shows when a live sleep started more than **12 hours** ago: the shared banner on the card (Review opens the sheet) and at the top of the sheet.
- **Live sync and offline timers: shared, not copied.** Feed's breastfeed sync (`BreastfeedSyncService`: polling the live list every 5 s while visible, own actions applied at once, queued taps applied on top of the server's list) becomes a shared live-entries sync in `core/timers/`, used by Feed and Sleep (and Pump later). Sleep polls `GET /api/sleeps/in-progress`. Adds, edits, deletes and timer taps go through the shared device queue (spec 05 Offline), with the same snackbars.
- **No reminders, no notifications, no photos**, ever.

## User stories

- As a parent, I want to tap Start when the baby falls asleep and Stop when they wake, so the sleep is logged without any math.
- As my partner, I want to see on my phone that the baby is sleeping and for how long, and be able to stop it.
- As a parent, I want to see how long the baby has been awake, so I know when the next sleep is due.
- As a parent, I want to log a sleep I forgot by typing when it started and ended, and fix or delete a wrong one.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Sleep card
- [x] Highlight: "Awake for" with the time since the end of the most recent sleep that isn't live, updating live, and on the right that sleep's duration labelled "last sleep".
- [x] With no sleep at all, an empty state is shown.
- [ ] Running state: while a sleep is live, the highlight shows "Sleeping" with its live duration and a Stop button; tapping it opens the Sleep sheet. Once stopped, the normal highlight is back.
- [ ] + opens the Sleep sheet directly (one kind); while a sleep is live, + is the timer button opening it.

### Sleep sheet
- [x] A single timer: the live duration (or the duration of a stopped sleep) and a Start / Stop button (M3 tonal, filled while running).
- [x] Start when no sleep is live creates a live sleep for the selected baby with start time = now.
- [x] Stop ends it (end time = now); the sleep is no longer live. Start on it again makes it live again, its duration running from the original start time.
- [x] Rows: Start time (set by Start, editable), End time (editable when not live, "Sleeping…" while live), Duration (end − start, read-only), Notes.
- [x] A past sleep can be logged entirely by hand: start time and end time, then Save. Typing an end time disables Start until Save or ×.
- [x] Save saves the start time, end time and notes and never starts or stops the timer: a live sleep stays live.
- [x] × on a sheet opened to add, once Start created the sleep, asks to discard and deletes it; × on an existing sleep discards the form edits and leaves a running timer running.
- [x] Save is disabled when the end time is missing (not live) or not after the start time, and when a time is in the future (1 min tolerance).
- [x] Delete (live or stopped sleep) deletes it after confirmation.
- [x] At most one live sleep per baby: opening the sheet while one is live (e.g. from another device) opens that one; Start refused with 409 opens the live one.
- [ ] A live sleep older than 12 hours shows a "Still sleeping?" warning on the card and in the sheet.

### Entry list item
- [x] `bedtime` icon, headline: the start time; supporting text: "1h 30m · until 2:30 PM" (end time in spec 04's entry time format); a live sleep shows "Sleeping · 45m" with its live duration.
- [ ] A live sleep is listed in the card and history from its first Start.
- [x] Entries logged by a deleted account still show that person's display name.

### Shared timer state
- [ ] The live sleep is stored on the server; reloading or opening the app on another member's device shows the same state and duration, computed from the stored start time.
- [ ] Other devices see Start, Stop and edits within a few seconds without a manual refresh.
- [ ] While a sleep is live it appears in the mini-bar ("Sleeping 45m 10s"); a stopped one doesn't.
- [ ] Feed's live sync runs on the shared live-entries sync, its tests still green.

### Editing and validation
- [x] Any member can edit or delete any sleep; changes are saved with who edited it and when.
- [x] Sleeps are deleted with their baby (03).

### Offline
- [ ] With no network, every action that creates or changes a sleep (Start, Stop, Save, manual entry, edit, delete) is queued on the device with its own time and applied when back online; re-sending is idempotent (client UUIDs).
- [ ] A sleep started offline keeps running and displaying on that device, also after the app is reopened.
- [ ] If a queued sleep reaches the server while another sleep is live for the same baby, both are kept.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Sleep entity, manual entry, card and history.** `Sleep` entity + migration (client UUID, baby FK with cascade, start time, end time nullable, notes, logged by, created at, updated at/by). Core `SleepService`: validation, create (idempotent), update, delete, paged list. Endpoints `POST/PUT/DELETE/GET /api/sleeps…` and `GET /api/babies/{babyId}/sleeps`. Web: `sleep` section registered (card, history, one kind, so + opens the sheet), `SleepService`, Sleep sheet without the timer (start time, end time, read-only duration, notes, delete), card highlight "Awake for" + last sleep duration + empty state, entry list item, history; add / edit / delete through the shared offline queue. Covers: card highlight and empty state, manual entry, validation, list item, editing, cascade, offline add/edit/delete.
- [x] **Slice 2 — Single timer.** Start / stop endpoints (one live per baby, 409 `sleepInProgress`, `queued` exception), `PUT` on a live sleep, `GET /api/sleeps/in-progress`. Web: new shared **`nala-timer`** (one duration + Start / Stop, M3 tonal → filled), timer in the Sleep sheet, End time row "Sleeping…" while live, manual mode disabling Start, Save / × per spec 04, opening the live sleep, live sleep in the card and history lists. Covers: the Sleep sheet timer criteria and the live list item.
- [ ] **Slice 3 — Shared live sync, running state, mini-bar.** Move `BreastfeedSyncService`'s polling and queued-tap overlay into a shared live-entries sync in `core/timers/` and run Feed on it (Feed tests green). Sleep's sync and `RUNNING_TIMER_SOURCES` entry ("Sleeping"), card running state with Stop, timer button, "Still sleeping?" banner. Covers: running state, timer button, Shared timer state, "Still sleeping?", and "A live sleep is listed in the card and history from its first Start" (other devices list it once the sync reloads their card).
- [ ] **Slice 4 — Offline timers.** Start / Stop through the device queue (`queued: true` on Start), the live sleep shown from the server's list with waiting taps on top, a queued sleep kept as a separate one. Covers: Offline criteria 2 and 3, and the timer part of criterion 1.

## Data

- **Sleep:** id (client UUID), baby, start time (UTC), end time (UTC, null while live), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: duration (end − start, or now − start while live), live (no end time).
- Sleeps are deleted with their baby (03).

## UI notes

- Section colour token: `sleep` (violet palette, already in `_sections.scss`), with its container tokens.
- Shared with Feed since slice 1 (moved out of Feed, not copied): API `Nala.Core/Entries` (`UserName`, `EntryCursor`, `EntryFields`, `EntryPaging`), `Nala.Api/Entries` (`UserNameResponse`); web `core/entries` (`UserName`, `EntryResult` / `EntryDeleteResult` with `toEntryResult` / `toDeleteResult`). `nala-time-row` offers "Add" when empty and shows `beforeStart`. `nala-notes-row` opens as soon as its control gets notes (also for an entry loaded once the sheet is open, e.g. the live sleep it adopts).
- New shared component: **`nala-timer`**, a single timer (duration + Start / Stop), reused by later timer sections. Reused: section card, timer button, entry sheet, `nala-time-row`, notes row, banner, entry list item, history list, mini-bar.
- All text through i18n (EN/FR).

## Out of scope

- Nap / night categories, location, how the baby fell asleep, night wakings (decided: not wanted).
- Pauses inside a sleep (segments): restarting a stopped sleep continues it from its start time.
- Overlap checks between sleeps.
- Reminders and notifications, photos (never).
- Totals, statistics, charts, sleep schedules or "next nap" predictions (Trends, feature 12).

## Open questions

- None so far.
