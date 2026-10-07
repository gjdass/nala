# 06 — Sleep

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions, the offline queue and the Timers rules, including **Single-timer entries** (rows, manual entry, start / stop endpoints and codes), all apply. This spec only adds what is specific to Sleep.

## Goal

Log the selected baby's sleeps with a single Start / Stop timer, or by typing a start and end time afterwards, and see at a glance how long the baby has been awake.

## Decisions

- **One kind, no categories.** A sleep is a sleep: no nap / night distinction, no location, no "how they fell asleep". A sleep has a start time, an end time and notes, nothing else. Section icon and kind icon: `bedtime`. One kind, so + opens the Sleep sheet directly.
- **One timer, no segments** (spec 04 Single-timer entries). Start on a stopped sleep continues it from its original start time (the baby woke briefly and went back to sleep). Unlike Breastfeed, there is nothing per side to keep.
- **Endpoints** (spec 04 entry API conventions and single-timer endpoints): resource `/api/sleeps`, body `{ id, babyId, startTime, endTime, notes }`, list ordered by start time then id, not found `sleepNotFound`, live conflict `sleepInProgress`, `sleeps` list in `GET /api/live`.
- **Card highlight:** "Awake for" (FR "Temps d'éveil") with the time since the **end** of the most recent sleep that isn't live (the one that ended last among the card's loaded entries; no separate endpoint), in spec 04's highlight duration format ("1h 20m", "45m", "<1m", ">24h"); on the right, in an M3 display/headline typescale, that sleep's duration (highlight duration format), labelled "last sleep". With no sleep at all: an empty state.
- **While live:** End time reads "Sleeping…"; mini-bar row "Sleeping" with the live duration.
- **"Still sleeping?"** after **12 hours** live.
- **Deleted elsewhere:** snackbar "This sleep was deleted on another device."

## User stories

- As a parent, I want to tap Start when the baby falls asleep and Stop when they wake, so the sleep is logged without any math.
- As my partner, I want to see on my phone that the baby is sleeping and for how long, and be able to stop it.
- As a parent, I want to see how long the baby has been awake, so I know when the next sleep is due.
- As a parent, I want to log a sleep I forgot by typing when it started and ended, and fix or delete a wrong one.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for sleeps.
- [x] Spec 04's shared timed-entry and single-timer criteria hold for sleeps (End time "Sleeping…" while live, mini-bar "Sleeping 45m 10s", 12-hour "Still sleeping?").

### Sleep card
- [x] Highlight: "Awake for" with the time since the end of the most recent sleep that isn't live, updating live, and on the right that sleep's duration labelled "last sleep", both in hours and minutes only ("<1m", ">24h" at the ends).
- [x] With no sleep at all, an empty state is shown.
- [x] + opens the Sleep sheet directly (one kind).

### Entry list item
- [x] `bedtime` icon, headline: the start time; supporting text: "1h 30m · until 2:30 PM" (end time in spec 04's entry time format); a live sleep shows "Sleeping · 45m" with its live duration.

## Build slices

Built in 4 slices, all done; each is a commit "Spec 06 slice N: …" (`git log --grep "Spec 06 slice"`).

## Data

- **Sleep:** id (client UUID), baby, start time (UTC), end time (UTC, null while live), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: duration (end − start, or now − start while live), live (no end time).

## UI notes

- Section colour token: `sleep` (violet palette).
- Shared components built for this feature: `nala-timer`; the shared live-entries sync (`LiveEntriesSync`) and the single-timer sheet logic (`LiveEntrySheet`, with Pump), see spec 04.
- Live sync: `SleepSyncService` on `LiveEntriesSync`, overlay `applyQueuedSleeps` (`core/sleeps/sleep.ts`) on the shared `applyQueuedTimedEntries`.

## Out of scope

- Nap / night categories, location, how the baby fell asleep, night wakings (decided: not wanted).
- Pauses inside a sleep (segments): restarting a stopped sleep continues it from its start time.
- Overlap checks between sleeps.
- Totals, statistics, charts, sleep schedules or "next nap" predictions (Trends, feature 12).
