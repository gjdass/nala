# 08 — Pump

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions, the offline queue and the Timers rules, including **Single-timer entries** (rows, manual entry, start / stop endpoints and codes), all apply. Pump works like Sleep (06) with a volume per side. This spec only adds what is specific to Pump.

## Goal

Log pumping sessions for the selected baby with a single Start / Stop timer, or by typing them afterwards, with the volume pumped from each breast, and see at a glance how long ago the last session was and how much it gave.

## Decisions

- **One kind.** A pumping session has a start time, an end time, a left volume, a right volume and notes, nothing else. Section icon and kind icon: `water_drop`. One kind, so + opens the Pump sheet directly.
- **Pumping belongs to a baby**, like every entry: it is logged for the selected baby (the milk is for them). No per-parent pumping log.
- **One timer for the session** (shared `nala-timer`, like Sleep), not one per side: double pumping runs both sides at once, and one side at a time is still one session. No segments (spec 04 Single-timer entries).
- **Volume per side: Left ml and Right ml**, two optional whole numbers, 0–500 each. Empty (null) means not recorded; 0 means that side gave nothing (or wasn't pumped). Total = left + right, counting an empty side as 0; with both empty the session has no volume. Volumes can be typed at any time, also while live, and are saved with Save.
- **Endpoints** (spec 04 entry API conventions and single-timer endpoints): resource `/api/pumps`, body `{ id, babyId, startTime, endTime, leftMl, rightMl, notes }`, list ordered by start time then id, not found `pumpNotFound`, live conflict `pumpInProgress`, `pumps` list in `GET /api/live`.
- **Validation codes:** spec 04's single-timer codes, plus `leftMl` / `rightMl` `outOfRange` (not 0–500) and `invalid` (not a whole number).
- **Card highlight:** "Last pumped" (FR "Dernier tirage") with the time since the **start** of the most recent session that isn't live (the one that started last among the card's loaded entries; pumping is scheduled start to start), in spec 04's highlight duration format; on the right, in an M3 display/headline typescale, that session's total ("180 ml"), or "—" when it has no volume, with no label under it. With no session at all: an empty state.
- **While live:** End time reads "Pumping…"; mini-bar row "Pumping" with the live duration.
- **"Still pumping?"** after **1 hour** live.
- **Deleted elsewhere:** snackbar "This pumping session was deleted on another device."

## User stories

- As a parent, I want to tap Start when I begin pumping and Stop when I'm done, then type how much each side gave, so the session is logged with no math.
- As a parent, I want to see how long ago I last pumped and how much I got, so I know when the next session is due.
- As my partner, I want to see on my phone that a pumping session is running.
- As a parent, I want to log a session I forgot by typing its times and volumes, and fix or delete a wrong one.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for pumping sessions.
- [x] Spec 04's shared timed-entry and single-timer criteria hold for pumping sessions (End time "Pumping…" while live, mini-bar "Pumping 12m 10s", 1-hour "Still pumping?").

### Pump card
- [x] Highlight: "Last pumped" with the time since the start of the most recent session that isn't live, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that session's total in ml, or "—" without volume.
- [x] With no session at all, an empty state is shown.
- [x] + opens the Pump sheet directly (one kind).

### Pump sheet
- [x] Rows: Start time, End time, Duration (read-only), Left ml, Right ml, Total (read-only, shown when a side has a volume), Notes.
- [x] Left and Right are optional whole numbers 0–500; Save is disabled outside that range.
- [x] Volumes can be typed and saved while the session is live; Save never starts or stops the timer.

### Entry list item
- [x] `water_drop` icon, headline: the start time and total ("2:30 PM · 180 ml", or the time alone without volume); supporting text: "L 90 ml · R 90 ml · 20m" (empty sides left out); a live session shows "Pumping · 12m" with its live duration.

## Build slices

Built in 3 slices, all done; each is a commit "Spec 08 slice N: …" (`git log --grep "Spec 08 slice"`).

## Data

- **Pump:** id (client UUID), baby, start time (UTC), end time (UTC, null while live), left ml (int, nullable), right ml (int, nullable), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: duration, total ml, live (no end time).

## UI notes

- Section colour token: `pump` (rose palette).
- Left ml / Right ml: two number fields side by side in one row (shared `nala-number-fields-row`, built for this feature: outlined M3 text fields, numeric keyboard, "ml" suffix). Labels: Left / Gauche, Right / Droite, Total / Total.
- Live sync: `PumpSyncService` on `LiveEntriesSync`, overlay `applyQueuedPumps` (`core/pumps/pump.ts`) on the shared `applyQueuedTimedEntries`; the sheet on `LiveEntrySheet`, adding its volumes through its hooks.
- Kind label: Pump / Tire-lait (as the section's name).

## Out of scope

- Per-side timers (decided: one timer per session).
- Milk stash / freezer inventory, bottle labels, linking a pumped session to the bottles fed from it.
- Pump brand, flange size, suction settings.
- Totals, statistics, charts, daily output (Trends, feature 12).
