# 05 — Feed

Status: specified

Layout vocabulary (section card, kind picker, entry sheet, mini-bar…) is defined in [04 — App layout](04-app-layout.md).

## Goal

Log every feeding of the selected baby — breastfeed, bottle (breast milk or formula) and solids — in a few taps, one-handed, and see at a glance when the last feed was and which breast to start next.

## Decisions

- **Breastfeed has two independent per-side timers (left / right).** This is a hard requirement. The Breastfeed sheet shows two side-by-side timers, each with its own duration and its own Start/Stop button. A single timer with a "side" field is not acceptable.
- **One side runs at a time.** Starting a side stops the other. Each side accumulates its own duration, and a feed can switch sides any number of times (L → R → L).
- **Timers live on the server.** An in-progress breastfeed is visible on every member's device, and anyone can switch sides, pause or finish it. It survives closing the app. Offline, the timer runs locally and syncs later (see Offline).
- **No reminders or notifications**, ever.
- **No photos** on entries, ever.

## User stories

- As a parent, I want to tap Start Left or Start Right to time that breast, and the other side to switch, so I don't have to do any math.
- As my partner, I want to see on my phone that a feed is in progress, and be able to finish it.
- As a parent, I want to see how long ago the last feed was and which side it ended on, so I know which breast to offer next.
- As a parent, I want to log a bottle (breast milk or formula) with how many ml were drunk, reusing the last amount in one tap.
- As a parent, I want to log solids: which meal, what the baby ate and how they reacted.
- As a parent, I want to add a feed I forgot to log, and fix or delete a wrong one.

## Kinds

| Kind | Icon | Sheet title |
|------|------|-------------|
| Bottle | bottle | Bottle Feed |
| Breastfeed | breast | Breastfeed |
| Solids | spoon | Solids |

The Feed section has several kinds, so + opens the kind picker (Bottle Feed, Breastfeed, Solids).

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Feed card
- [ ] Highlight: "Last feeding" with the time since the **start** of the most recent feed of any kind (e.g. "26m ago"), and on the right, in an M3 display/headline typescale, the side the most recent finished breastfeed ended on ("right" / "left") labelled "last side".
- [ ] If there has been no breastfeed yet, the "last side" part is hidden; with no feed at all, an empty state is shown.
- [ ] Running state: while a breastfeed is in progress, the highlight shows "Feeding" with both sides' live durations, the running side marked, and quick controls to switch side and pause. Tapping it opens the Breastfeed sheet.

### Breastfeed sheet
- [ ] Two timers side by side, Left and Right. Each shows its side's accumulated duration and a Start/Stop button ("Start Left", "Start Right" / "Stop"; M3 tonal button, filled while that side runs).
- [ ] The side the previous breastfeed ended on is marked with a "last side" label above its timer.
- [ ] Tapping Start on a side when no feed is in progress creates an in-progress breastfeed for the selected baby, with its start time = now, and starts that side.
- [ ] Tapping Start on the other side while one side runs stops the running side and starts the tapped side.
- [ ] Tapping Stop on the running side stops it; the feed stays in progress (paused).
- [ ] Each side's duration is the sum of all of its timed segments; the two durations are never merged into one stored value.
- [ ] Rows: Start time (set automatically when a timer starts, editable), Total time (sum of both sides, read-only), Notes.
- [ ] × closes the sheet and leaves an in-progress feed running.
- [ ] Save finishes the feed: any running side is stopped, the end time is set, and the feed appears in the history.
- [ ] Delete (shown for an in-progress or saved feed) deletes it after confirmation.
- [ ] A feed saved with both sides at 0 s is refused (Save disabled).
- [ ] There is at most one in-progress breastfeed per baby. Opening Breastfeed while one exists (e.g. started from another device) opens that feed instead of a new one.
- [ ] An in-progress feed older than 3 hours shows a "Still feeding?" warning in the card and sheet, offering to save it and correct durations.

### Manual entry and correction (breastfeed)
- [ ] Each side's duration has a pencil action that lets the user type a duration (minutes and seconds) instead of using the timer.
- [ ] A past feed can be logged entirely by hand: set the start time, enter one or both durations with the pencils, save.
- [ ] When durations are entered by hand, the user chooses which side the feed ended on (default: the side with the last edit).

### Shared timer state
- [ ] The in-progress feed, its segments and the running side are stored on the server; reloading the app or opening it on another member's device shows the same state and durations.
- [ ] Other devices see changes (side switch, pause, save) within a few seconds without a manual refresh.
- [ ] Durations shown are computed from stored segment start/end timestamps, not from a client-side counter, so they stay correct after the app was closed.
- [ ] While a breastfeed is in progress, it appears in the running timers mini-bar ("Feeding · L 12:04").

### Bottle Feed sheet
- [ ] Rows: Start time (default now), Milk type (breast milk / formula, required, segmented button), Amount in ml (required, whole number, 1–500), Notes.
- [ ] The milk type defaults to the one used in that baby's previous bottle.
- [ ] When the amount is empty and a previous bottle of the selected milk type exists, a suggestion row offers "Use last <milk type> amount: <n> ml?"; tapping Yes fills the amount.

### Solids sheet
- [ ] Meal type at the top as single-select filter chips: Breakfast, Lunch, Dinner, Snack (optional).
- [ ] Rows: Start time (default now), Food (required free text, 1–500 characters, multi-line), Reaction (optional, single-select filter chips: liked / neutral / disliked / allergic reaction), Notes.

### Entry list items
- [ ] Breastfeed: breast icon, time, duration bar proportional to total duration, total duration ("8m 30s"), and the per-side split ("L 5m · R 3m 30s").
- [ ] Bottle: bottle icon, time, "<milk type> · <n> ml".
- [ ] Solids: spoon icon, time, meal type if any ("12:00pm Lunch"), then the food text (up to 2 lines), and the reaction if any.
- [ ] Entries logged by a deleted account still show that person's display name.

### Editing and validation
- [ ] Any member can edit or delete any feed; changes are saved with who edited it and when.
- [ ] Times cannot be in the future (1 minute tolerance), and a breastfeed's end cannot be before its start.

### Offline
- [ ] With no network, every action above that creates or changes a feed (timer taps, save, manual entry, edit, delete) is queued on the device with its own timestamp and applied when back online.
- [ ] While offline, a breastfeed timer started on this device keeps running and displaying correctly.
- [ ] Re-sending a queued action is idempotent (client-generated UUIDs for feeds and segments).
- [ ] If the session has expired while entries are queued offline, the queue is kept on the device; it is sent after the user logs in again, as the same user only (moved from 02).
- [ ] If a queued breastfeed reaches the server while another in-progress feed exists for the same baby, both are kept as separate feeds; nothing is dropped.

## Data

A feed is one entity with a kind (breastfeed / bottle / solids) and kind-specific fields; breastfeed timing is stored as segments.

- **Feed:** id (client UUID), baby, kind, start time (UTC), end time (UTC, null while in progress — breastfeed only), notes, logged by user, created at, updated at, updated by user.
  - Bottle: milk type (breast milk / formula), amount ml.
  - Solids: meal type (nullable), food, reaction (nullable).
- **BreastFeedSegment:** id (client UUID), feed, side (left / right), started at (UTC), ended at (UTC, null while running). At most one open segment per feed.
- Derived, not stored: per-side duration (sum of segments), ended-on side (side of the last segment), running side.
- A breastfeed with durations typed by hand is stored as synthetic segments: one per side with a non-zero duration, ordered so the ended-on side comes last.
- Feeds are deleted with their baby (03).

## UI notes

- Section colour token: `feed` (light and dark values in the global theme).
- New shared component for this feature: **split timer** (two side-by-side timers with Start/Stop and a pencil for manual duration) — reused later by Pump.
- Live updates across devices: server-sent events or polling; the choice is technical, the requirement is "within a few seconds".
- All text through i18n (EN/FR).

## Out of scope

- Reminders and notifications (never).
- Photos (never).
- Daily totals, statistics and charts.
- Combined breastfeed + bottle top-up as a single entry (log them as two feeds).
- A food catalogue or per-food allergy tracking beyond the reaction field.
- Pumping (feature 10).
