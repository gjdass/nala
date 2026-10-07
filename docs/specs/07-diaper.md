# 07 — Diaper

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions and the offline queue apply. Diaper has no timer, so 04's Timers part doesn't. This spec only adds what is specific to Diaper.

## Goal

Log the selected baby's diaper changes in a few taps (wet, dirty, both or dry, diaper rash, and for a dirty diaper its colour and consistency) and see at a glance how long ago the last change was.

## Decisions

- **One kind, no timer.** A diaper change is a single moment: a time, wet / dirty toggles, a diaper-rash toggle, notes, and for a dirty diaper an optional colour and consistency. Section icon and kind icon: `baby_changing_station`. One kind, so + opens the Diaper sheet directly.
- **Wet and Dirty are two independent toggles**, not a single selector. Neither on means a **dry** diaper; both on is "Wet + dirty". The sheet opens with both off, and saving with both off is allowed (a dry diaper). Displayed type: "Wet", "Dirty", "Wet + dirty", "Dry" (FR "Mouillée", "Selles", "Mouillée + selles", "Sèche").
- **Diaper rash** is a third independent toggle (FR "Érythème fessier"), shown as a switch, not a chip.
- **Dirty details:** two optional single-choice rows (shared `nala-chip-choice-row`), shown only while Dirty is on:
  - **Colour** (`yellow`, `green`, `brown`, `black`, `red`, `white`), each chip with a small colour dot. Black, red and white are the colours paediatricians flag.
  - **Consistency** (`liquid`, `runny`, `soft`, `firm`, `hard`).
  - Turning Dirty off hides and clears them; Save then sends them as null. The API ignores them when `dirty` is false (not validated, stored and returned null).
- **Endpoints** (spec 04 entry API conventions): resource `/api/diapers`, body `{ id, babyId, time, wet, dirty, rash, color, consistency, notes }`, `PUT` replaces every field, list ordered by time then id, not found `diaperNotFound`.
- **Validation codes:** `time` `required`, `color` `invalid`, `consistency` `invalid` (only checked when `dirty`), plus spec 04's common codes. `wet`, `dirty`, `rash` default to false when missing.
- **Adding:** the sheet opens with the time at now, every toggle off, no details.
- **Card highlight:** "Last change" (FR "Dernier change") with the time since the most recent diaper (latest time among the card's loaded entries; no separate endpoint), in spec 04's highlight duration format; on the right, in an M3 display/headline typescale, that diaper's type ("Wet + dirty"…), with a "Rash" label (FR "Érythème") under it when its rash toggle is on. With no diaper at all: an empty state.

## User stories

- As a parent, I want to log a diaper change in two taps (wet, dirty or both), so I can do it one-handed while holding the baby.
- As a parent, I want to note the colour and consistency of a dirty diaper and whether there is a rash, so I can answer the paediatrician's questions.
- As a parent, I want to see how long ago the last change was, so I know when the next one is due.
- As a parent, I want to fix or delete a wrong entry, and log one I forgot at an earlier time.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for diapers.

### Diaper card
- [x] Highlight: "Last change" with the time since the most recent diaper, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that diaper's type, with a rash indicator when it had a rash.
- [x] With no diaper at all, an empty state is shown.
- [x] + opens the Diaper sheet directly (one kind).

### Diaper sheet
- [x] Rows: Time (at now when adding), Type (Wet and Dirty toggle chips), Diaper rash switch, Notes.
- [x] Wet and Dirty are independent: either, both or neither can be on; with neither, the diaper is saved as dry.
- [x] Colour and Consistency chip rows show only while Dirty is on; both are optional, single choice, and colour chips show a colour dot.
- [x] Turning Dirty off hides the details and saves them as null.

### Entry list item
- [x] `baby_changing_station` icon, headline: the time and the type ("2:30 PM · Wet + dirty", "Dry"); supporting text: colour · consistency · "Rash" when present, otherwise the notes (one line, ellipsis).

### API and validation
- [x] Colour and consistency are ignored and returned null when `dirty` is false; unknown values → `invalid`.

## Build slices

Built in 2 slices, all done; each is a commit "Spec 07 slice N: …" (`git log --grep "Spec 07 slice"`).

## Data

- **Diaper:** id (client UUID), baby, time (UTC), wet (bool), dirty (bool), rash (bool), colour (nullable enum), consistency (nullable enum), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: type (wet / dirty / wet + dirty / dry).

## UI notes

- Section colour token: `diaper` (cyan palette).
- Shared components built for this feature: `nala-chip-toggles-row` (Wet / Dirty in the "Type" row, FR "Type") and `nala-switch-row` (Diaper rash).
- Colour dots: `nala-chip-choice-row`'s `dotToken` (a CSS custom-property prefix); each chip shows an outlined dot in `var(<dotToken><option>)`, inside the label so it stays visible next to the selected chip's checkmark. The Colour row uses `--nala-stool-<colour>`, defined in `src/styles/_stool-colors.scss` as the real stool colours, the same in light and dark.
- Labels: Colour / Couleur, Consistency / Consistance; colours Yellow, Green, Brown, Black, Red, White (FR Jaune, Vert, Marron, Noir, Rouge, Blanc); consistencies Liquid, Runny, Soft, Firm, Hard (FR Liquide, Semi-liquide, Molle, Ferme, Dure).

## Out of scope

- Timers, live sync, mini-bar (a change is instantaneous).
- Diaper brand / size, stock tracking, cost.
- Daily counts, totals, statistics, charts (Trends, feature 12).
