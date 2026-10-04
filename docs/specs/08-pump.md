# 08 — Pump

Status: done

Layout vocabulary (section card, entry sheet, timers, mini-bar…) is defined in [04 — App layout](04-app-layout.md). The timer rules (live or not, Save never starts or stops a timer, ×) are spec 04's **Timers** rules; this spec only adds what is specific to Pump. Pump works like Sleep (06) with a volume per side: everything not listed here behaves as in Sleep.

## Goal

Log pumping sessions for the selected baby with a single Start / Stop timer, or by typing them afterwards, with the volume pumped from each breast, and see at a glance how long ago the last session was and how much it gave.

## Decisions

- **One kind.** A pumping session has a start time, an end time, a left volume, a right volume and notes, nothing else. Section icon and kind icon: `water_drop`. With one kind, + opens the Pump sheet directly (spec 04).
- **Pumping belongs to a baby**, like every entry: it is logged for the selected baby (the milk is for them). No per-parent pumping log.
- **One timer for the session** (shared `nala-timer`, like Sleep), not one per side: double pumping runs both sides at once, and one side at a time is still one session. It follows spec 04's Timers rules: a session is **live** while its timer runs and an ordinary session otherwise. No segments: Start on a stopped session makes it live again by clearing its end time, its duration running from the original start time (as Sleep).
- **Volume per side: Left ml and Right ml**, two optional whole numbers, 0–500 each. Empty (null) means not recorded; 0 means that side gave nothing (or wasn't pumped). Total = left + right, counting an empty side as 0; with both empty the session has no volume. Volumes can be typed at any time, also while live, and are saved with Save.
- **Typed times, not a typed duration**, as Sleep: Start time and End time rows (shared `nala-time-row`), duration end − start read-only.
- **Pump endpoints** (same shape and codes as Sleep's): `POST /api/pumps` with `{ id, babyId, startTime, endTime, leftMl, rightMl, notes }` creates a stopped session (`endTime` required) → 201; existing id → 200 unchanged (idempotent re-send). `PUT /api/pumps/{id}` with `{ startTime, endTime, leftMl, rightMl, notes }` → 200: on a stopped session it replaces all of them; on a live session `endTime` must be null and the session stays live. `DELETE /api/pumps/{id}` → 204; `GET /api/pumps/{id}` → 200; unknown → 404 `{ code: "pumpNotFound" }`. `GET /api/babies/{babyId}/pumps?cursor=&limit=` → `{ entries, next }`, newest first (start time, then id), 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. Unknown baby → 404 `{ code: "babyNotFound" }`. Each session carries `endTime` (null while live), `loggedBy` and `updatedBy`.
- **Timer endpoints**, as Sleep's: `POST /api/pumps/{id}/start` `{ babyId, at, queued? }` (unknown id → live session, 201; stopped → live again, 200; live → unchanged, 200; another live session for the baby → 409 `{ code: "pumpInProgress" }` unless `queued: true`), `POST /api/pumps/{id}/stop` `{ at }`. Live sessions reach other devices through spec 04's `GET /api/live` (its `pumps` list: every baby's live session, oldest start first).
- **Validation codes:** Sleep's (`id`, `babyId`, `startTime`, `endTime`, `at`, `notes`), with `pumpInProgress` / `pumpNotFound`, plus `leftMl` / `rightMl` `outOfRange` (not 0–500) and `invalid` (not a whole number).
- **One live session per baby**, enforced by the service, with the queued exception (as Sleep).
- **Adding by hand, manual mode, Save and ×** follow Sleep exactly (start time at now, End time "Add", typing an end time disables Start until Save or ×, live End time row reads "Pumping…").
- **Card highlight:** "Last pumped" (FR "Dernier tirage") with the time since the **start** of the most recent session that isn't live (the one that started last among the card's loaded entries; pumping is scheduled start to start), in spec 04's highlight duration format ("1h 20m", "45m", "<1m", ">24h"); on the right, in an M3 display/headline typescale, that session's total ("180 ml"), or "—" when it has no volume, with no label under it. With no session at all: an empty state.
- **While live:** normal highlight, no timer on the card (spec 04); + is the timer button opening the Pump sheet. Mini-bar row: "Pumping" with the live duration.
- **"Still pumping?"** shows when a live session started more than **1 hour** ago: the shared banner on the card (Review opens the sheet) and at the top of the sheet.
- **Shared, not copied:** live sync on `LiveEntriesSync` (spec 06), timer sources through `provideRunningTimerSource`, offline through the shared device queue (spec 05 Offline). Changes or deletion on another device are followed as in Sleep ("This pumping session was deleted on another device.").
- **No reminders, no notifications, no photos**, ever.

## User stories

- As a parent, I want to tap Start when I begin pumping and Stop when I'm done, then type how much each side gave, so the session is logged with no math.
- As a parent, I want to see how long ago I last pumped and how much I got, so I know when the next session is due.
- As my partner, I want to see on my phone that a pumping session is running.
- As a parent, I want to log a session I forgot by typing its times and volumes, and fix or delete a wrong one.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Pump card
- [x] Highlight: "Last pumped" with the time since the start of the most recent session that isn't live, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that session's total in ml, or "—" without volume.
- [x] With no session at all, an empty state is shown.
- [x] + opens the Pump sheet directly (one kind); while a session is live, + is the timer button opening it, and the card keeps its normal highlight with no timer.

### Pump sheet
- [x] A single timer (shared `nala-timer`): the live duration (or the duration of a stopped session) and Start / Stop.
- [x] Start when no session is live creates a live session for the selected baby with start time = now; Stop ends it; Start on it again makes it live again from its original start time.
- [x] Rows: Start time, End time ("Pumping…" while live), Duration (read-only), Left ml, Right ml, Total (read-only, shown when a side has a volume), Notes.
- [x] Left and Right are optional whole numbers 0–500; Save is disabled outside that range.
- [x] Volumes can be typed and saved while the session is live; Save never starts or stops the timer.
- [x] A past session can be logged entirely by hand: times, volumes, then Save. Typing an end time disables Start until Save or ×.
- [x] Save is disabled when the end time is missing (not live) or not after the start time, and when a time is in the future (1 min tolerance).
- [x] × on a sheet opened to add, once Start created the session, asks to discard and deletes it; × on an existing session discards the form edits and leaves a running timer running.
- [x] Delete (live or stopped) deletes it after confirmation.
- [x] At most one live session per baby: opening the sheet while one is live opens that one; Start refused with 409 opens the live one.
- [x] A live session older than 1 hour shows a "Still pumping?" warning on the card and in the sheet.

### Entry list item
- [x] `water_drop` icon, headline: the start time and total ("2:30 PM · 180 ml", or the time alone without volume); supporting text: "L 90 ml · R 90 ml · 20m" (empty sides left out); a live session shows "Pumping · 12m" with its live duration.
- [x] A live session is listed in the card and history from its first Start.
- [x] Entries logged by a deleted account still show that person's display name.

### API and validation
- [x] Create, idempotent re-send, update (stopped and live), delete, get, paged list, start / stop, with the codes above.
- [x] Any member can edit or delete any session; changes are saved with who edited it and when.
- [x] Pump sessions are deleted with their baby (03).

### Shared timer state
- [x] The live session is stored on the server; reloading or opening the app on another member's device shows the same state and duration.
- [x] Other devices see Start, Stop and edits within a few seconds (spec 04's `GET /api/live`, `pumps` list).
- [x] While a session is live it appears in the mini-bar ("Pumping 12m 10s"); a stopped one doesn't.

### Offline
- [x] With no network, every action that creates or changes a session (Start, Stop, Save, manual entry, edit, delete) is queued on the device with its own time and applied when back online; re-sending is idempotent.
- [x] A session started offline keeps running and displaying on that device, also after the app is reopened.
- [x] If a queued session reaches the server while another is live for the same baby, both are kept.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Pump entity, manual entry, card and history.** `Pump` entity + migration (client UUID, baby FK with cascade, start time, end time nullable, left ml, right ml, notes, logged by, created at, updated at/by). Core `PumpService` (validation, create idempotent, update, delete, paged list) reusing `Nala.Core/Entries`. Endpoints `POST/PUT/DELETE/GET /api/pumps…` and `GET /api/babies/{babyId}/pumps`. Web: `pump` section registered (one kind, + opens the sheet), `PumpService`, Pump sheet without the timer (times, duration, Left / Right ml, total, notes, delete), card highlight + empty state, entry list item, history; add / edit / delete through the shared offline queue. Covers: card highlight and empty state, manual entry, volumes, validation, list item, API, editing, cascade, offline add / edit / delete.
- [x] **Slice 2 — Timer, live sync and mini-bar.** Start / stop endpoints (one live per baby, 409 `pumpInProgress`, `queued` exception), `PUT` on a live session, `pumps` in `GET /api/live`. Web: `nala-timer` in the Pump sheet, End time "Pumping…", manual mode, Save / × per spec 04, opening the live session, `PumpSyncService` on `LiveEntriesSync`, running timer source ("Pumping"), timer button, "Still pumping?" banner, sheet following changes / deletion elsewhere. Start / Stop already go through the device queue (`queued: true` on a Start kept offline), as Sleep's. Covers: the timer sheet criteria, live list item, Shared timer state.
- [x] **Slice 3 — Offline timers.** The queued-changes overlay for pumps (`applyQueuedPumps` on `PumpSyncService`): a session started, stopped or edited offline shows at once on the device, also after the app is reopened, and a queued session reaching the server while another is live is kept as a separate one. Covers: Offline criteria 2 and 3, and the timer part of criterion 1.

## Data

- **Pump:** id (client UUID), baby, start time (UTC), end time (UTC, null while live), left ml (int, nullable), right ml (int, nullable), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: duration, total ml, live (no end time).
- Pump sessions are deleted with their baby (03).

## UI notes

- Section colour token: `pump` (rose palette, already in `_sections.scss`), with its container tokens.
- Left ml / Right ml: two number fields side by side in one row (one-handed, numeric keyboard), "ml" suffix. Labels: Left / Gauche, Right / Droite, Total / Total.
- Reused: section card, timer button, entry sheet, `nala-timer`, `nala-time-row`, notes row, banner, entry list item, history list, mini-bar, `LiveEntriesSync`, device queue.
- New shared component (slice 1): **`nala-number-fields-row`** (`shared/ui/number-fields-row/`), number fields side by side in one sheet row (outlined M3 text fields, label, numeric keyboard, unit suffix, one error message), for Left / Right ml and later Growth.
- Shared with Sleep since slice 2 (moved, not copied): API `Nala.Core/Entries/EntryTimer` (the Start / Stop rules, on `ITimedEntry` / `ITimedEntryRepository`, results `TimerResult<TEntry>`) and `EntryFields.ValidateTimerAt`; web `shared/ui/entry-sheet/live-entry-sheet.ts` (`LiveEntrySheet`: the start / end time and notes controls, timer, Save, Delete, ×, opening the live entry and following other devices; Pump adds its volumes through its hooks), `core/timers/stopped-entry.ts` and `core/time/live-longer-than.ts`.
- Shared with Sleep since slice 3 (moved, not copied): web `core/timers/queued-timed-entries.ts` (`applyQueuedTimedEntries`: the server's start / stop / edit / delete rules applied to the changes waiting on the device, the section giving its path, its fields of a new entry and the fields an edit sets). Pump's overlay is `applyQueuedPumps` (`core/pumps/pump.ts`), on `PumpSyncService`.
- Shared with Sleep since slice 1 (moved, not copied): API `EntryFields.ValidateStartEnd` (the start / end time rules); web `core/time/span-seconds.ts` (`spanSeconds`, start to end or to now) and `core/time/after-start.ts` (the `beforeStart` validator).
- Kind label: Pump / Tire-lait (as the section's name).
- All text through i18n (EN/FR).

## Out of scope

- Per-side timers (decided: one timer per session).
- Milk stash / freezer inventory, bottle labels, linking a pumped session to the bottles fed from it.
- Pump brand, flange size, suction settings.
- Totals, statistics, charts, daily output (Trends, feature 12).
- Reminders and notifications, photos (never).

## Open questions

- None so far.
