# 05 — Feed

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions, the offline queue and the Timers rules (live or not, Save never starts or stops a timer, ×, one live entry per baby, live sync, mini-bar) all apply. This spec only adds what is specific to Feed.

## Goal

Log every feeding of the selected baby — breastfeed, bottle (breast milk or formula) and solids — in a few taps, one-handed, and see at a glance when the last feed was and which breast to start next.

## Kinds

| Kind | Icon | Sheet title |
|------|------|-------------|
| Bottle | `water_bottle` (no baby bottle glyph in Material Symbols) | Bottle Feed |
| Breastfeed | `breastfeeding` | Breastfeed |
| Solids | `nutrition` (no spoon glyph in Material Symbols) | Solids |

Several kinds, so + opens the kind picker (Bottle Feed, Breastfeed, Solids). Section icon: `restaurant`.

## Decisions

- **One entity with a kind:** a feed is a bottle, a breastfeed or solids, with the fields of the other kinds null. Breastfeed timing is stored as segments.
- **Breastfeed has two independent per-side timers (left / right).** This is a hard requirement. The Breastfeed sheet shows two side-by-side timers (shared `nala-split-timer`), each with its own duration and its own Start/Stop button. A single timer with a "side" field is not acceptable.
- **One side runs at a time.** Starting a side stops the other. Each side accumulates its own duration, and a feed can switch sides any number of times (L → R → L). A breastfeed is **live** while one of its sides runs (spec 04 Timers).
- **Feed endpoints** (spec 04 entry API conventions, resource `/api/feeds`, not found `feedNotFound`, list ordered by start time then id): body `{ id, babyId, kind, startTime, notes, …kind fields }`; bottle: `milkType` `breastMilk`/`formula`, `amountMl`; solids: `mealType` `breakfast`/`lunch`/`dinner`/`snack` or null, `food`, `reaction` `liked`/`neutral`/`disliked`/`allergicReaction` or null. `PUT` replaces every field of the feed's kind. `GET /api/babies/{babyId}/feeds/bottle-defaults` → `{ milkType, lastAmountMl: { breastMilk, formula } }` (latest bottle's milk type, last amount of each; null when none).
- **Validation codes:** `kind` `required`/`invalid`, `startTime` `required`, `milkType` `required`/`invalid`, `amountMl` `required`/`invalid` (not whole)/`outOfRange` (1–500), `mealType` `invalid`, `food` `required` (blank)/`tooLong` (over 500 once trimmed), `reaction` `invalid`, plus spec 04's common codes.
- **Breastfeed endpoints:** a breastfeed is driven by its timers, or entered by hand with `durations: { leftSeconds, rightSeconds, endedOn }` (whole seconds, 0–14400 = 4 h per side).
  - `POST /api/feeds` with `kind: breastfeed` needs `durations` and creates a stopped feed. `PUT /api/feeds/{id}` on a breastfeed changes its start time and notes, live or not, and leaves its sides as they are; with `durations` it also replaces its segments, and the feed stays live or not as it was.
  - Typed durations are stored as synthetic segments running back to back from the start time (zero sides skipped). On a feed that isn't live the ended-on side is last and the end time is start + total. On a live feed the running side is last and its segment stays open (started at start + the other side), so it keeps running; `endedOn` and the running side's seconds are ignored (its duration runs from the start time sent).
  - `POST /api/feeds/{id}/breastfeed/start` `{ babyId, segmentId, side, at, queued? }` starts `left`/`right` at `at` and stops the other side: an unknown id creates the live breastfeed (start time = `at`) → 201; an existing one becomes live again (end time cleared) → 200; re-sending a `segmentId` or starting the side that already runs changes nothing → 200. Another live breastfeed of the baby → 409 `{ code: "breastfeedInProgress" }` unless `queued: true` (spec 04 Timers).
  - `POST /api/feeds/{id}/breastfeed/stop` `{ at }` stops the running side and sets the end time to `at` (nothing running → 200 unchanged).
  - `GET /api/babies/{babyId}/feeds/breastfeed` → `{ inProgress: feed | null, lastSide: "left" | "right" | null }`: the live breastfeed (with two live, the oldest), and the side of the last segment of the latest breastfeed that isn't live. "In progress" in API names (`inProgress`, `breastfeedInProgress`) means live; the names are kept so requests already queued on devices still work.
  - Every feed carries `segments: [{ id, side, startedAt, endedAt }]` (empty for other kinds); clients derive the durations from them. A non-breastfeed id on a breastfeed endpoint → 404 `feedNotFound`.
  - Codes: `durations` `required` (breastfeed POST without) / `outOfRange` / `zero` (both sides at 0 s), `endedOn` `required`/`invalid` (only when both sides are above 0; otherwise the non-zero side is used), `side` `required`/`invalid`, `at` `required`/`invalid` (before the feed's latest segment time), `segmentId` `required`, `startTime` `afterEnd` (the end can't be before the start).
- **At most one open segment per feed** is enforced by the database; one live breastfeed per baby by the service (spec 04).
- **Save and × in the Breastfeed sheet:** Save sends the start time and notes (`PUT`), and the typed durations when there are some; a feed that doesn't exist yet (typed durations only) is created (`POST`). × follows spec 04.
- **Typed durations in the sheet:** typing a side's duration corrects it (spec 04); the other side keeps its current value. On a live feed the start time moves to now − both sides and the running side keeps running from its value; on a feed that isn't live the end time moves to start + both sides. Start / Stop stays available. Save replaces the timed segments with the typed durations; a live feed stays live. The "Ended on" choice (Left/Right segmented button, default: the last side typed) shows only when both sides are above 0 on a feed that isn't live (a live one ends on its running side).
- **"Still feeding?"** after **3 hours** live (correct by tapping the durations, then Stop).
- **Mini-bar row:** "Feeding · L" with the running side's live duration.
- **Legacy compatibility** (kept for data and queues from before Timers' "live or not" rules): a migration gave every breastfeed without an end time and without a running segment (paused) the end of its last segment (its start time when it has none). Finish taps still waiting in a device's queue are sent as a Stop at the same time, followed by the start time and notes as an edit (`core/offline/queue-upgrades.ts`).

## User stories

- As a parent, I want to tap Start Left or Start Right to time that breast, and the other side to switch, so I don't have to do any math.
- As my partner, I want to see on my phone that a feed is live, and be able to stop it.
- As a parent, I want to add a note to the live feed without stopping its timer.
- As a parent, I want to see how long ago the last feed was and which side it ended on, so I know which breast to offer next.
- As a parent, I want to log a bottle (breast milk or formula) with how many ml were drunk, reusing the last amount in one tap.
- As a parent, I want to log solids: which meal, what the baby ate and how they reacted.
- As a parent, I want to add a feed I forgot to log, and fix or delete a wrong one.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for feeds.
- [x] Spec 04's shared timed-entry criteria hold for breastfeeds (mini-bar label "Feeding · L 12m 4s", 3-hour "Still feeding?").

### Feed card
- [x] Highlight: "Last feeding" with the time since the **start** of the most recent feed of any kind (e.g. "26m ago"), and on the right, in an M3 display/headline typescale, the side the most recent breastfeed that isn't live ended on, capitalised ("Right" / "Left"), labelled "last side".
- [x] If there has been no breastfeed yet, the "last side" part is hidden; with no feed at all, an empty state is shown.

### Breastfeed sheet
- [x] Two timers side by side, Left and Right. Each shows its side's accumulated duration and a Start/Stop button ("Start Left", "Start Right" / "Stop"; M3 tonal button, filled while that side runs).
- [x] The side the previous breastfeed ended on is marked with a "last side" label above its timer.
- [x] Tapping Start on a side when no feed is live creates a live breastfeed with its start time = now, and starts that side.
- [x] Tapping Start on the other side while one side runs stops the running side and starts the tapped side.
- [x] Tapping Stop on the running side stops it; the feed is no longer live (end time = now).
- [x] Each side's duration is the sum of all of its timed segments; the two durations are never merged into one stored value.
- [x] Rows: Start time (set automatically when a timer starts, editable), Total time (sum of both sides, read-only), Notes.
- [x] A feed saved with both sides at 0 s is refused (Save disabled).

### Manual entry and correction (breastfeed)
- [x] Tapping a side's duration lets the user type it (minutes and seconds) instead of using the timer (spec 04).
- [x] A past feed can be logged entirely by hand: set the start time, enter one or both durations by tapping them, save.
- [x] When durations are entered by hand on a feed that isn't live, the user chooses which side the feed ended on (default: the side with the last edit).
- [x] Typing a side's duration on a live feed keeps it live: the running side keeps running from its typed value, the start time moves to now − both sides, and Save stores the segments with the running side's segment still open (API: `PUT` with `durations` on a live feed).
- [x] A breastfeed's end cannot be before its start.
- [x] Breastfeeds paused before the "live or not" rules get an end time from their last segment (migration).

### Bottle Feed sheet
- [x] Rows: Start time (default now), Milk type (breast milk / formula, required, segmented button), Amount in ml (required, whole number, 1–500), Notes.
- [x] The milk type defaults to the one used in that baby's previous bottle.
- [x] When the amount is empty and a previous bottle of the selected milk type exists, a suggestion row offers "Use last <milk type> amount: <n> ml?"; tapping Yes fills the amount.

### Solids sheet
- [x] Meal type at the top as single-select filter chips: Breakfast, Lunch, Dinner, Snack (optional).
- [x] Rows: Start time (default now), Food (required free text, 1–500 characters, multi-line), Reaction (optional, single-select filter chips: liked / neutral / disliked / allergic reaction), Notes.

### Entry list items
- [x] Breastfeed: `breastfeeding` icon, time, then "Total 8m 30s · L 5m · R 3m 30s" (an unused side left out).
- [x] Bottle: bottle icon, time, "<milk type> · <n> ml".
- [x] Solids: `nutrition` icon, then a headline with the time, the meal type and the reaction when there are any ("12:00 PM · Lunch · Liked"), then the food text on one line (ellipsis when too long).

## Build slices

Built in 8 slices, all done; each is a commit "Spec 05 slice N: …" (`git log --grep "Spec 05 slice"`).

## Data

- **Feed:** id (client UUID), baby, kind (breastfeed / bottle / solids), start time (UTC), end time (UTC, breastfeed only: end of the last segment, null while live), notes, logged by user, created at, updated at, updated by user.
  - Bottle: milk type (breast milk / formula), amount ml.
  - Solids: meal type (nullable), food, reaction (nullable).
- **BreastFeedSegment:** id (client UUID), feed, side (left / right), started at (UTC), ended at (UTC, null while running). At most one open segment per feed.
- Derived, not stored: per-side duration (sum of segments), ended-on side (side of the last segment), running side, live (a segment is open).

## UI notes

- Section colour token: `feed` (orange palette).
- Shared components built for this feature: `nala-split-timer`, `nala-duration-field` + `nala-duration-dialog`, `nala-banner`, `nala-chip-choice-row`.
- Live sync: `BreastfeedSyncService` on `LiveEntriesSync` (spec 04), list `feeds` in `GET /api/live`.

## Out of scope

- Combined breastfeed + bottle top-up as a single entry (log them as two feeds).
- A food catalogue or per-food allergy tracking beyond the reaction field.
- Pumping (feature 08).
