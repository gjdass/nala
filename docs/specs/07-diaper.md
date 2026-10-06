# 07 — Diaper

Status: done

Layout vocabulary (section card, entry sheet, entry list item, highlight duration…) is defined in [04 — App layout](04-app-layout.md). Diaper has no timer, so spec 04's Timers rules, the mini-bar and `GET /api/live` don't apply; this spec only adds what is specific to Diaper.

## Goal

Log the selected baby's diaper changes in a few taps (wet, dirty, both or dry, diaper rash, and for a dirty diaper its colour and consistency) and see at a glance how long ago the last change was.

## Decisions

- **One kind, no timer.** A diaper change is a single moment: a time, wet / dirty toggles, a diaper-rash toggle, notes, and for a dirty diaper an optional colour and consistency. Section icon and kind icon: `baby_changing_station`. With one kind, + opens the Diaper sheet directly (spec 04).
- **Wet and Dirty are two independent toggles**, not a single selector. Neither on means a **dry** diaper; both on is "Wet + dirty". The sheet opens with both off, and saving with both off is allowed (a dry diaper). Displayed type: "Wet", "Dirty", "Wet + dirty", "Dry" (FR "Mouillée", "Selles", "Mouillée + selles", "Sèche").
- **Diaper rash** is a third independent toggle (FR "Érythème fessier"), shown as a switch (spec 04: on/off field), not a chip.
- **Dirty details:** two optional single-choice rows (shared `nala-chip-choice-row`), shown only while Dirty is on:
  - **Colour** (`yellow`, `green`, `brown`, `black`, `red`, `white`), each chip with a small colour dot. Black, red and white are the colours paediatricians flag.
  - **Consistency** (`liquid`, `runny`, `soft`, `firm`, `hard`).
  - Turning Dirty off hides and clears them; Save then sends them as null. The API ignores them when `dirty` is false (not validated, stored and returned null, like Feed's fields of another kind).
- **Diaper endpoints:** `POST /api/diapers` with `{ id, babyId, time, wet, dirty, rash, color, consistency, notes }` → 201; sending an existing id again → 200 with the stored diaper unchanged (idempotent re-send). `PUT /api/diapers/{id}` with `{ time, wet, dirty, rash, color, consistency, notes }` replaces every field → 200. `DELETE /api/diapers/{id}` → 204; `GET /api/diapers/{id}` → 200; unknown diaper → 404 `{ code: "diaperNotFound" }`. `GET /api/babies/{babyId}/diapers?cursor=&limit=` → `{ entries, next }`, newest first (time, then id), 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. Unknown baby → 404 `{ code: "babyNotFound" }`. Each diaper carries `loggedBy` and `updatedBy` (`{ id, displayName }`).
- **Validation codes:** `id` / `babyId` `required`, `time` `required`, `color` `invalid`, `consistency` `invalid` (only checked when `dirty`), `notes` `tooLong` (spec 04, 1000). `wet`, `dirty`, `rash` default to false when missing.
- **Adding:** the sheet opens with the time at now, every toggle off, no details. Save is the only action (no timer, so × simply discards).
- **Card highlight:** "Last change" (FR "Dernier change") with the time since the most recent diaper (latest time among the card's loaded entries; no separate endpoint), in spec 04's highlight duration format ("1h 20m", "45m", "<1m", ">24h"); on the right, in an M3 display/headline typescale, that diaper's type ("Wet + dirty"…), with a "Rash" label (FR "Érythème") under it when its rash toggle is on. With no diaper at all: an empty state.
- **Offline:** add, edit and delete go through the shared device queue (spec 05 Offline), with the same snackbars.
- **No reminders, no notifications, no photos**, ever.

## User stories

- As a parent, I want to log a diaper change in two taps (wet, dirty or both), so I can do it one-handed while holding the baby.
- As a parent, I want to note the colour and consistency of a dirty diaper and whether there is a rash, so I can answer the paediatrician's questions.
- As a parent, I want to see how long ago the last change was, so I know when the next one is due.
- As a parent, I want to fix or delete a wrong entry, and log one I forgot at an earlier time.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Diaper card
- [x] Highlight: "Last change" with the time since the most recent diaper, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that diaper's type, with a rash indicator when it had a rash.
- [x] With no diaper at all, an empty state is shown.
- [x] + opens the Diaper sheet directly (one kind).

### Diaper sheet
- [x] Rows: Time (shared `nala-time-row`, at now when adding), Type (Wet and Dirty toggle chips), Diaper rash switch, Notes.
- [x] Wet and Dirty are independent: either, both or neither can be on; with neither, the diaper is saved as dry.
- [x] Colour and Consistency chip rows show only while Dirty is on; both are optional, single choice, and colour chips show a colour dot.
- [x] Turning Dirty off hides the details and saves them as null.
- [x] A time in the future is accepted (spec 04).
- [x] An existing diaper opens with its values; Save replaces them; × discards the form edits.
- [x] Delete deletes it after confirmation.

### Entry list item
- [x] `baby_changing_station` icon, headline: the time and the type ("2:30 PM · Wet + dirty", "Dry"); supporting text: colour · consistency · "Rash" when present, otherwise the notes (one line, ellipsis).
- [x] Entries logged by a deleted account still show that person's display name.

### API and validation
- [x] Create, idempotent re-send, update, delete, get, paged list (newest first, cursor, limit 1–50) with the codes above.
- [x] Colour and consistency are ignored and returned null when `dirty` is false; unknown values → `invalid`.
- [x] Any member can edit or delete any diaper; changes are saved with who edited it and when.
- [x] Diapers are deleted with their baby (03).

### Offline
- [x] With no network, adding, editing and deleting a diaper are queued on the device and applied when back online; re-sending is idempotent (client UUIDs).

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Diaper entity, sheet, card and history.** `Diaper` entity + migration (client UUID, baby FK with cascade, time, wet, dirty, rash, notes, logged by, created at, updated at/by). Core `DiaperService`: validation, create (idempotent), update, delete, paged list, reusing `Nala.Core/Entries`. Endpoints `POST/PUT/DELETE/GET /api/diapers…` and `GET /api/babies/{babyId}/diapers`. Web: `diaper` section registered (card, history, one kind, so + opens the sheet), `DiaperService`, Diaper sheet (time, Wet / Dirty toggle chips, rash toggle, notes, delete), card highlight "Last change" + type + empty state, entry list item (headline with type, notes as supporting text), history; add / edit / delete through the shared offline queue. Covers: card, sheet rows / toggles / validation / edit / delete, list item headline, API and validation (without colour / consistency), offline.
- [x] **Slice 2 — Dirty details.** `color` and `consistency` columns + migration, Core validation (`invalid`, nulled when not dirty). Web: Colour (with colour dots) and Consistency `nala-chip-choice-row`s shown while Dirty is on, cleared when it's turned off; list item supporting text (colour · consistency · "Rash", else notes). Covers: the dirty details criteria and the list item supporting text.

## Data

- **Diaper:** id (client UUID), baby, time (UTC), wet (bool), dirty (bool), rash (bool), colour (nullable enum), consistency (nullable enum), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: type (wet / dirty / wet + dirty / dry).
- Diapers are deleted with their baby (03).

## UI notes

- Section colour token: `diaper` (cyan palette, already in `_sections.scss`), with its container tokens.
- Reused: section card, entry sheet, `nala-time-row`, `nala-chip-choice-row`, notes row, entry list item, history list, empty state, confirm dialog.
- New shared components (slice 1): **`nala-chip-toggles-row`** (a form row of multi-select filter chips, each chip bound to its own boolean control: Wet / Dirty in the "Type" row, FR "Type") and **`nala-switch-row`** (a form row with a trailing switch: Diaper rash).
- Colour dots (slice 2): `nala-chip-choice-row` takes an optional `dotToken` (a CSS custom-property prefix); with it each chip shows an outlined dot in `var(<dotToken><option>)`, inside the label so it stays visible next to the selected chip's checkmark. The Colour row uses `--nala-stool-<colour>`, defined in `src/styles/_stool-colors.scss` as the real stool colours, the same in light and dark.
- Labels: Colour / Couleur, Consistency / Consistance; colours Yellow, Green, Brown, Black, Red, White (FR Jaune, Vert, Marron, Noir, Rouge, Blanc); consistencies Liquid, Runny, Soft, Firm, Hard (FR Liquide, Semi-liquide, Molle, Ferme, Dure).
- All text through i18n (EN/FR).

## Out of scope

- Timers, live sync, mini-bar (a change is instantaneous).
- Diaper brand / size, stock tracking, cost.
- Daily counts, totals, statistics, charts (Trends, feature 12).
- Reminders and notifications, photos (never).

## Open questions

- None so far.
