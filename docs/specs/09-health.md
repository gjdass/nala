# 09 — Health

Status: done (slices 1–2 built as "Medication", slice 3 renamed it Health, slice 4 added temperature)

Layout vocabulary (section card, entry sheet, entry list item, suggestion row, highlight duration…) is defined in [04 — App layout](04-app-layout.md). Health has no timer, so spec 04's Timers rules, the mini-bar and `GET /api/live` don't apply; this spec only adds what is specific to Health. It works like Diaper (07): everything not listed here behaves as in Diaper.

## Goal

Log the baby's health events in a few taps: each dose of medicine or supplement given (what, how much, when) and body temperature readings, and see at a glance how long ago the last entry was.

## Decisions

- **Renamed from Medication.** The section was built as "Medication" (slices 1–2) and is renamed Health everywhere, not only in the UI: section key, colour token, web folders and classes, API routes, Core/Sql classes, database table, error code, i18n. Existing entries are kept (the table is renamed, not recreated). Names below are the target names.
- **Naming.** An entry is a *health entry* (`HealthEntry`). Because `/api/health` is already the health check (01), the routes use `health-entries`. Server folders are `HealthEntries` (`Nala.Core/HealthEntries`, `Nala.Sql/HealthEntries`, `Nala.Api/HealthEntries`), away from the health check's `Nala.Api/Health`. Web: `core/health-entries/`, `features/health/`. Concepts that are about the medicine itself keep a medicine name: `RecentMedicine` (was `RecentMedication`), `DoseUnit` (was `MedicationUnit`), the dose formatter.
- **One kind, no timer.** An entry is a single moment: a time, an optional medicine (name + optional dose), an optional temperature, notes. Section icon and kind icon: `medical_services`. With one kind, + opens the Health sheet directly (spec 04).
- **Name or temperature.** An entry needs at least a medicine name or a temperature (both allowed). With neither, Save is disabled and the API answers `name` `required`.
- **The medicine is a free-text name**, not a managed list: no medicine table. Name: optional, 1–100 characters once trimmed, stored as typed (trimmed); blank is stored null.
- **Dose: amount + unit.** Amount is optional and only with a name: a positive number, at most 2 decimals, 0.01–1000. Unit is one of `ml`, `mg`, `drops`, `dose` (FR ml, mg, gouttes, dose), single choice; required when an amount is given, ignored and stored null without one. An amount without a name is refused (`amount` `nameRequired`). Displayed "2.5 ml", "10 drops", "1 dose".
- **Dose display:** the amount is formatted in the active language (EN "2.5 ml", FR "2,5 ml"). Drops and doses take the singular for exactly 1 ("1 drop" / "10 drops", "1 dose" / "2 doses"; FR "1 goutte" / "10 gouttes", "1 dose" / "2 doses"); ml and mg never change.
- **Temperature:** optional, in degrees Celsius only (metric, 00), 30.0–45.0, at most 1 decimal, stored as typed. Displayed in the active language, always with one decimal, with a no-break space: EN "38.5 °C" / "38.0 °C", FR "38,5 °C". The app never interprets it: no fever threshold, no colour, no warning.
- **Recent names:** the sheet shows the baby's recently used names as one-tap chips under the Name field (shared `nala-chip-choice-row`): up to **5 distinct names** (compared case-insensitively), most recently given first, from entries that have a name. Tapping a chip fills the Name field with its spelling. The row is labelled "Recent" (FR « Récents »). The chip matching the Name field (trimmed, case-insensitive) is shown selected; tapping it again keeps the name (the row is not clearable). Shown when editing an entry too. The chips come from `GET /api/babies/{babyId}/health-entries/recent`; offline or on error the row is simply not shown.
- **Last dose suggestion:** when the Name field matches a recent name (case-insensitive) and the amount is empty, a suggestion row offers that name's last dose ("Use last dose: 2.5 ml? [Yes]", shared `nala-suggestion-row`, as Feed's bottle amount). Yes fills amount and unit. No suggestion when that name's latest entry had no amount. Shown when editing an entry too.
- **Health endpoints:** `POST /api/health-entries` with `{ id, babyId, time, name, amount, unit, temperature, notes }` → 201; existing id → 200 with the stored entry unchanged (idempotent re-send). `PUT /api/health-entries/{id}` with `{ time, name, amount, unit, temperature, notes }` replaces every field → 200. `DELETE /api/health-entries/{id}` → 204; `GET /api/health-entries/{id}` → 200; unknown → 404 `{ code: "healthEntryNotFound" }`. `GET /api/babies/{babyId}/health-entries?cursor=&limit=` → `{ entries, next }`, newest first (time, then id), 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. `GET /api/babies/{babyId}/health-entries/recent` → `[{ name, amount, unit }]` (the 5 distinct names above, each with the dose of its latest entry with that name; entries at the same time are ordered by id, as in the list). Unknown baby → 404 `{ code: "babyNotFound" }`. Each entry carries `loggedBy` and `updatedBy` (`{ id, displayName }`); `name` and `temperature` are null when not given.
- **Old routes are removed**, no alias: `/api/medications…` answer 404 after the update. The not-found message reads "This entry no longer exists." (FR « Cette entrée n'existe plus. »). A change still in a device's queue from before the update is refused and dropped with the usual snackbar (spec 05 Offline), accepted since the section has just shipped.
- **Validation codes:** `id` / `babyId` `required`, `time` `required`, `name` `required` (no name and no temperature) / `tooLong`, `amount` `outOfRange` / `invalid` (more than 2 decimals) / `nameRequired` (amount without name), `unit` `required` (amount without unit) / `invalid`, `temperature` `outOfRange` / `invalid` (more than 1 decimal), `notes` `tooLong` (spec 04, 1000).
- **Section preferences:** the section key changes from `medication` to `health`. Each user's stored row for `medication` becomes `health` with the same position and visibility (a user who hid or moved the section keeps that).
- **Adding:** the sheet opens with the time at now, an empty name, no amount, no unit, no temperature. Save is disabled until a name or a temperature is filled. × simply discards.
- **Card highlight:** "Last entry" (FR "Dernière entrée") with the time since the most recent entry (latest time among the card's loaded entries), in spec 04's highlight duration format; on the right, in an M3 display/headline typescale, that entry's name, with a label under it made of its dose and its temperature joined by " · " ("2.5 ml · 38.5 °C") when it has either; an entry without a name shows its temperature in the headline typescale and no label. With no entry at all: an empty state, "No entry logged yet" (FR « Aucune entrée enregistrée »).
- **Offline:** add, edit and delete go through the shared device queue (spec 05 Offline), with the same snackbars.
- **No medical advice:** the app never suggests a dose, an interval or a maximum, never interprets a temperature, and never warns about either.
- **No reminders, no notifications, no photos**, ever.

## User stories

- As a parent, I want to log that I gave paracetamol or vitamin D drops, with the amount, in a few taps.
- As a parent, I want the medicines I give often to be one tap away, with their usual dose.
- As a parent, I want to log my baby's temperature, alone or with the medicine I gave for it.
- As a parent, I want to see how long ago the last entry was, so I don't give a dose too early.
- As my partner, I want to see what was given, the temperatures taken and when, so we don't give the same dose twice.
- As a parent, I want to fix or delete a wrong entry, and log one I forgot at an earlier time.

## Acceptance criteria

Each item becomes at least one test, written failing first. Criteria checked during slices 1–2 stay checked; their tests are renamed in slice 3 and adapted in slice 4 where the wording changed.

### Health card
- [x] Highlight: "Last entry" with the time since the most recent entry, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that entry's name with its dose and temperature under it when it has them, or its temperature alone when it has no name.
- [x] With no entry at all, an empty state is shown.
- [x] + opens the Health sheet directly (one kind).

### Health sheet
- [x] Rows: Time (shared `nala-time-row`, at now when adding), Name (text field), recent-name chips, Dose (amount field), Unit (unit chips), Temperature (°C field), Notes.
- [x] Save is disabled while both the name and the temperature are blank, when an amount is given without a name, when an amount is outside 0.01–1000 or has more than 2 decimals, when an amount has no unit, and when a temperature is outside 30.0–45.0 or has more than 1 decimal. A time in the future is accepted (spec 04).
- [x] An entry with only a temperature, only a name, or both can be saved.
- [x] The recent-name chips list up to 5 distinct names, most recent first; tapping one fills the name. Without recent names (none yet, offline, error) the row is hidden.
- [x] When the name matches a recent name and the amount is empty, a suggestion row offers its last dose; Yes fills amount and unit. No suggestion when that name's latest dose had no amount. Shown when editing an entry too.
- [x] Clearing the amount saves the unit as null.
- [x] An existing entry opens with its values (temperature included); Save replaces them; × discards the form edits.
- [x] Delete deletes it after confirmation.

### Entry list item
- [x] `medical_services` icon, headline: the time and the name ("2:30 PM · Paracetamol"), or the time and the temperature when there is no name ("2:30 PM · 38.5 °C"); supporting text: the dose, the temperature (only when the headline shows the name) and the notes, those that exist, joined by " · " (one line, ellipsis).
- [x] Entries logged by a deleted account still show that person's display name.

### Rename
- [x] The section is called Health (FR Santé) in the home card, sheet, history and settings; its key is `health`, its colour token `health`.
- [x] The API serves `/api/health-entries…` and `/api/babies/{babyId}/health-entries…`; `/api/medications…` no longer exist; unknown entry → `healthEntryNotFound`.
- [x] The migration renames the table to `health_entries` (keys, indexes, foreign keys and PostgreSQL's named NOT NULL constraints renamed too) and keeps every existing entry.
- [x] Stored section preferences for `medication` become `health` with the same position and visibility; the default order is Feed, Sleep, Diaper, Pump, Growth, Health.

### API and validation
- [x] Create, idempotent re-send, update, delete, get, paged list (newest first, cursor, limit 1–50) with the codes above, temperature included.
- [x] Name or temperature required; amount without name refused; temperature range and decimals validated.
- [x] Recent names: at most 5, distinct case-insensitively (the latest spelling wins), most recently given first, each with the dose of its latest entry with that name; entries without a name are ignored; only that baby's entries.
- [x] Unit is ignored and returned null without an amount.
- [x] Any member can edit or delete any entry; changes are saved with who edited it and when.
- [x] Entries are deleted with their baby (03).

### Offline
- [x] With no network, adding, editing and deleting an entry are queued on the device and applied when back online; re-sending is idempotent (client UUIDs).

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Medication entity, sheet, card and history.** `Medication` entity + migration (client UUID, baby FK with cascade, time, name, amount, unit, notes, logged by, created at, updated at/by). Core `MedicationService` (validation, create idempotent, update, delete, paged list) reusing `Nala.Core/Entries`. Endpoints `POST/PUT/DELETE/GET /api/medications…` and `GET /api/babies/{babyId}/medications`. Web: `medication` section registered (one kind, + opens the sheet), `MedicationService`, Medication sheet (time, name, amount + unit, notes, delete), card highlight "Last dose" + empty state, entry list item, history; add / edit / delete through the shared offline queue.
- [x] **Slice 2 — Recent names and last dose.** `GET /api/babies/{babyId}/medications/recent`. Web: recent-name chips under the Name field, last-dose suggestion row.
- [x] **Slice 3 — Rename Medication to Health (no behaviour change).** API: `Medication` → `HealthEntry` (and `MedicationService`, `MedicationFields`, `IMedicationRepository`, `MedicationRepository`, `MedicationConfiguration`, `MedicationEndpoints`, `MedicationEntry` to their `HealthEntry…` names; `RecentMedication` → `RecentMedicine`, `MedicationUnit` → `DoseUnit`), folders `HealthEntries`, routes `health-entries`, code `healthEntryNotFound`. Migration `RenameMedicationsToHealthEntries`: rename table `medications` → `health_entries` with its primary key, indexes and foreign keys, and update `user_section_preferences` rows with key `medication` to `health`. `SectionKeys`: `medication` → `health`. Web: `core/medications` → `core/health-entries` (`HealthEntryService`, models, dose formatter), `features/medication` → `features/health` (`health-card`, `health-sheet`, `health-entry`, `health-history`, `health.section`), `SECTION_KEYS`, colour token `health` in `_sections.scss`, section/kind icon `medical_services`, i18n ids and labels Health / Santé, test fixtures (`testing/health-entries.ts`). Tests renamed with the code, and new tests for the migration (table renamed, rows kept, preference key moved) and the removed old routes. Covers: the Rename criteria.
- [x] **Slice 4 — Temperature, name optional.** `temperature` column (nullable `numeric(3,1)`) by migration, `name` column made nullable. Core: temperature validation, name-or-temperature rule, amount needs a name, recent names skip entries without a name. Web: Temperature row in the sheet, Save rules, card highlight "Last entry" with dose · temperature, list item headline/supporting text, temperature formatter (EN/FR). Covers: the card highlight, sheet rows / Save / name-or-temperature / edit criteria, list item criterion, the API create/validation/recent criteria.

## Data

- **HealthEntry** (table `health_entries`): id (client UUID), baby, time (UTC), name (nullable), amount (decimal, nullable, 2 decimals), unit (nullable enum: ml, mg, drops, dose), temperature (decimal °C, nullable, 1 decimal), notes, logged by user, created at, updated at, updated by user. At least one of name and temperature is set.
- Derived, not stored: displayed dose, displayed temperature, recent names.
- Entries are deleted with their baby (03).

## UI notes

- Section colour token: `health` (red palette, renamed from `medication` in `_sections.scss`), with its container tokens.
- Dose row: the amount number field (decimal keyboard, M3 outlined text field, as Feed's bottle amount), then a Unit row (FR Unité) with the unit chips (`nala-chip-choice-row`). While an amount has no unit, the Unit row shows "Choose a unit for the amount" under the chips through `nala-chip-choice-row`'s `error`.
- Temperature row (FR Température): a number field (decimal keyboard, M3 outlined text field) with a "°C" suffix, after the Unit row and before Notes.
- Field errors: Name "Enter a name or a temperature" / "100 characters at most", Dose "0.01 to 1000" / "2 decimals at most" / "Enter a name for this dose", Temperature "30 to 45 °C" / "1 decimal at most".
- Reused: section card, entry sheet, `nala-time-row`, `nala-chip-choice-row` (unit, recent names), `nala-suggestion-row`, notes row, entry list item, history list, empty state, confirm dialog, device queue.
- Labels: Health / Santé (section and kind), Name / Nom, Dose / Dose, Unit / Unité, Temperature / Température, units ml, mg, drops, dose (FR ml, mg, gouttes, dose), Last entry / Dernière entrée, "Use last dose: {dose}?" / « Reprendre la dernière dose : {dose} ? ».
- All text through i18n (EN/FR).

## Out of scope

- A managed medicine list or catalogue, prescriptions, stock.
- Schedules, minimum intervals, maximum daily doses, dosage by weight, any warning or advice about doses.
- Fahrenheit, fever thresholds, temperature colours or warnings, the measuring method (rectal, ear…).
- Other health events (symptoms, doctor visits, vaccines): add them to the overview as ideas if wanted.
- Timers, live sync, mini-bar (an entry is instantaneous).
- Daily counts, totals, statistics, charts (Trends, feature 12).
- Reminders and notifications, photos (never).

## Open questions

- None so far.
