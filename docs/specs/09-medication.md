# 09 — Medication

Status: in progress

Layout vocabulary (section card, entry sheet, entry list item, suggestion row, highlight duration…) is defined in [04 — App layout](04-app-layout.md). Medication has no timer, so spec 04's Timers rules, the mini-bar and `GET /api/live` don't apply; this spec only adds what is specific to Medication. It works like Diaper (07): everything not listed here behaves as in Diaper.

## Goal

Log each dose of medicine or supplement given to the selected baby (what, how much, when) in a few taps, and see at a glance how long ago the last dose was.

## Decisions

- **One kind, no timer.** A dose is a single moment: a time, a medicine name, an optional amount with its unit, notes. Section icon and kind icon: `medication`. With one kind, + opens the Medication sheet directly (spec 04).
- **The medicine is a free-text name**, not a managed list: no medicine table. Name: required, 1–100 characters once trimmed, stored as typed (trimmed).
- **Recent names:** the sheet shows the baby's recently used names as one-tap chips under the Name field (shared `nala-chip-choice-row`): up to **5 distinct names** (compared case-insensitively), most recently given first. Tapping a chip fills the Name field. The chips come from `GET /api/babies/{babyId}/medications/recent`; offline or on error the row is simply not shown.
- **Dose: amount + unit.** Amount is optional: a positive number, at most 2 decimals, 0.01–1000. Unit is one of `ml`, `mg`, `drops`, `dose` (FR ml, mg, gouttes, dose), single choice; required when an amount is given, ignored and stored null without one. Displayed "2.5 ml", "10 drops", "1 dose".
- **Dose display:** the amount is formatted in the active language (EN "2.5 ml", FR "2,5 ml"). Drops and doses take the singular for exactly 1 ("1 drop" / "10 drops", "1 dose" / "2 doses"; FR "1 goutte" / "10 gouttes", "1 dose" / "2 doses"); ml and mg never change.
- **Last dose suggestion:** when the Name field matches a recent name (case-insensitive) and the amount is empty, a suggestion row offers that name's last dose ("Use last dose: 2.5 ml? [Yes]", shared `nala-suggestion-row`, as Feed's bottle amount). Yes fills amount and unit.
- **Medication endpoints:** `POST /api/medications` with `{ id, babyId, time, name, amount, unit, notes }` → 201; existing id → 200 with the stored dose unchanged (idempotent re-send). `PUT /api/medications/{id}` with `{ time, name, amount, unit, notes }` replaces every field → 200. `DELETE /api/medications/{id}` → 204; `GET /api/medications/{id}` → 200; unknown → 404 `{ code: "medicationNotFound" }`. `GET /api/babies/{babyId}/medications?cursor=&limit=` → `{ entries, next }`, newest first (time, then id), 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. `GET /api/babies/{babyId}/medications/recent` → `[{ name, amount, unit }]` (the 5 distinct names above, each with the dose of its latest entry). Unknown baby → 404 `{ code: "babyNotFound" }`. Each dose carries `loggedBy` and `updatedBy` (`{ id, displayName }`).
- **Validation codes:** `id` / `babyId` `required`, `time` `required` / `inFuture` (1 min tolerance), `name` `required` (blank) / `tooLong`, `amount` `outOfRange` / `invalid` (more than 2 decimals), `unit` `required` (amount without unit) / `invalid`, `notes` `tooLong` (spec 04, 1000).
- **Adding:** the sheet opens with the time at now, an empty name, no amount, no unit. Save is disabled until the name is filled. × simply discards.
- **Card highlight:** "Last dose" (FR "Dernière prise") with the time since the most recent dose (latest time among the card's loaded entries), in spec 04's highlight duration format; on the right, in an M3 display/headline typescale, that dose's name, with its dose ("2.5 ml") as a label under it when it has one. With no dose at all: an empty state.
- **Offline:** add, edit and delete go through the shared device queue (spec 05 Offline), with the same snackbars.
- **No medical advice:** the app never suggests a dose, an interval or a maximum, and never warns about them.
- **No reminders, no notifications, no photos**, ever.

## User stories

- As a parent, I want to log that I gave paracetamol or vitamin D drops, with the amount, in a few taps.
- As a parent, I want the medicines I give often to be one tap away, with their usual dose.
- As a parent, I want to see how long ago the last dose was, so I don't give one too early.
- As my partner, I want to see what was given and when, so we don't give the same dose twice.
- As a parent, I want to fix or delete a wrong entry, and log one I forgot at an earlier time.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Medication card
- [x] Highlight: "Last dose" with the time since the most recent dose, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that dose's name, with its dose under it when it has one.
- [x] With no dose at all, an empty state is shown.
- [x] + opens the Medication sheet directly (one kind).

### Medication sheet
- [ ] Rows: Time (shared `nala-time-row`, at now when adding), Name (text field), recent-name chips, Dose (amount field), Unit (unit chips), Notes.
- [x] Save is disabled while the name is blank, when an amount is outside 0.01–1000 or has more than 2 decimals, when an amount has no unit, and when the time is in the future (1 min tolerance).
- [ ] The recent-name chips list up to 5 distinct names, most recent first; tapping one fills the name. Without recent names (none yet, offline, error) the row is hidden.
- [ ] When the name matches a recent name and the amount is empty, a suggestion row offers its last dose; Yes fills amount and unit.
- [x] Clearing the amount saves the unit as null.
- [x] An existing dose opens with its values; Save replaces them; × discards the form edits.
- [x] Delete deletes it after confirmation.

### Entry list item
- [x] `medication` icon, headline: the time and the name ("2:30 PM · Paracetamol"); supporting text: the dose ("2.5 ml"), followed by " · " and the notes when both exist, otherwise whichever exists (one line, ellipsis).
- [x] Entries logged by a deleted account still show that person's display name.

### API and validation
- [x] Create, idempotent re-send, update, delete, get, paged list (newest first, cursor, limit 1–50) with the codes above.
- [ ] Recent names: at most 5, distinct case-insensitively (the latest spelling wins), most recently given first, each with the dose of its latest entry; only that baby's doses.
- [x] Unit is ignored and returned null without an amount.
- [x] Any member can edit or delete any dose; changes are saved with who edited it and when.
- [x] Doses are deleted with their baby (03).

### Offline
- [x] With no network, adding, editing and deleting a dose are queued on the device and applied when back online; re-sending is idempotent (client UUIDs).

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Medication entity, sheet, card and history.** `Medication` entity + migration (client UUID, baby FK with cascade, time, name, amount, unit, notes, logged by, created at, updated at/by). Core `MedicationService` (validation, create idempotent, update, delete, paged list) reusing `Nala.Core/Entries`. Endpoints `POST/PUT/DELETE/GET /api/medications…` and `GET /api/babies/{babyId}/medications`. Web: `medication` section registered (one kind, + opens the sheet), `MedicationService`, Medication sheet (time, name, amount + unit, notes, delete), card highlight "Last dose" + empty state, entry list item, history; add / edit / delete through the shared offline queue. Covers: card, sheet validation / edit / delete (rows without recent names, no suggestion), list item, API and validation (without recent), offline.
- [ ] **Slice 2 — Recent names and last dose.** `GET /api/babies/{babyId}/medications/recent`. Web: recent-name chips under the Name field, last-dose suggestion row. Covers: the recent-name and suggestion criteria, the recent API criterion.

## Data

- **Medication:** id (client UUID), baby, time (UTC), name, amount (decimal, nullable, 2 decimals), unit (nullable enum: ml, mg, drops, dose), notes, logged by user, created at, updated at, updated by user.
- Derived, not stored: displayed dose, recent names.
- Doses are deleted with their baby (03).

## UI notes

- Section colour token: `medication` (red palette, already in `_sections.scss`), with its container tokens.
- Dose row: the amount number field (decimal keyboard, M3 outlined text field, as Feed's bottle amount), then a Unit row (FR Unité) with the unit chips (`nala-chip-choice-row`). While an amount has no unit, the Unit row shows "Choose a unit for the amount" under the chips: `nala-chip-choice-row` takes an optional `error` (slice 1), shown through `nala-form-row`'s error.
- Field errors: Name "Enter a name" / "100 characters at most", Dose "0.01 to 1000" / "2 decimals at most".
- Reused: section card, entry sheet, `nala-time-row`, `nala-chip-choice-row` (unit, recent names), `nala-suggestion-row`, notes row, entry list item, history list, empty state, confirm dialog, device queue.
- Labels: Medication / Médicament (section and kind), Name / Nom, Dose / Dose, Unit / Unité, units ml, mg, drops, dose (FR ml, mg, gouttes, dose), Last dose / Dernière prise, "Use last dose: {dose}?" / « Reprendre la dernière dose : {dose} ? ».
- All text through i18n (EN/FR).

## Out of scope

- A managed medicine list or catalogue, prescriptions, stock.
- Schedules, minimum intervals, maximum daily doses, dosage by weight, any warning or advice about doses.
- Timers, live sync, mini-bar (a dose is instantaneous).
- Daily counts, totals, statistics, charts (Trends, feature 12).
- Reminders and notifications, photos (never).

## Open questions

- None so far.
