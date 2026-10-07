# 09 — Health

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions and the offline queue apply. Health has no timer, so 04's Timers part doesn't. It works like Diaper (07). This spec only adds what is specific to Health.

## Goal

Log the baby's health events in a few taps: each dose of medicine or supplement given (what, how much, when) and body temperature readings, and see at a glance how long ago the last entry was.

## Decisions

- **Naming.** An entry is a *health entry* (`HealthEntry`). Because `/api/health` is already the health check (01), the routes use `health-entries`. Server folders are `HealthEntries` (`Nala.Core/HealthEntries`, `Nala.Sql/HealthEntries`, `Nala.Api/HealthEntries`), away from the health check's `Nala.Api/Health`. Web: `core/health-entries/`, `features/health/`. Concepts about the medicine itself keep a medicine name: `RecentMedicine`, `DoseUnit`, the dose formatter.
- **One kind, no timer.** An entry is a single moment: a time, an optional medicine (name + optional dose), an optional temperature, notes. Section icon and kind icon: `medical_services`. One kind, so + opens the Health sheet directly.
- **Name or temperature.** An entry needs at least a medicine name or a temperature (both allowed). With neither, Save is disabled and the API answers `name` `required`.
- **The medicine is a free-text name**, not a managed list: no medicine table. Name: optional, 1–100 characters once trimmed, stored as typed (trimmed); blank is stored null.
- **Dose: amount + unit.** Amount is optional and only with a name: a positive number, at most 2 decimals, 0.01–1000. Unit is one of `ml`, `mg`, `drops`, `dose` (FR ml, mg, gouttes, dose), single choice; required when an amount is given, ignored and stored null without one. An amount without a name is refused (`amount` `nameRequired`).
- **Dose display:** the amount is formatted in the active language (EN "2.5 ml", FR "2,5 ml"). Drops and doses take the singular for exactly 1 ("1 drop" / "10 drops", "1 dose" / "2 doses"; FR "1 goutte" / "10 gouttes", "1 dose" / "2 doses"); ml and mg never change.
- **Temperature:** optional, in degrees Celsius only (metric, overview), 30.0–45.0, at most 1 decimal, stored as typed. Displayed in the active language, always with one decimal, with a no-break space: EN "38.5 °C" / "38.0 °C", FR "38,5 °C". The app never interprets it: no fever threshold, no colour, no warning.
- **Recent names:** the sheet shows the baby's recently used names as one-tap chips under the Name field (shared `nala-chip-choice-row`): up to **5 distinct names** (compared case-insensitively, the latest spelling wins), most recently given first, from entries that have a name. Tapping a chip fills the Name field with its spelling. The row is labelled "Recent" (FR « Récents »). The chip matching the Name field (trimmed, case-insensitive) is shown selected; tapping it again keeps the name (the row is not clearable). Shown when editing an entry too. Offline or on error the row is simply not shown.
- **Last dose suggestion:** when the Name field matches a recent name (case-insensitive) and the amount is empty, a suggestion row offers that name's last dose ("Use last dose: 2.5 ml? [Yes]", shared `nala-suggestion-row`). Yes fills amount and unit. No suggestion when that name's latest entry had no amount. Shown when editing an entry too.
- **Endpoints** (spec 04 entry API conventions): resource `/api/health-entries`, body `{ id, babyId, time, name, amount, unit, temperature, notes }`, `PUT` replaces every field, list ordered by time then id, not found `healthEntryNotFound` (message "This entry no longer exists." / « Cette entrée n'existe plus. »). `name` and `temperature` are null when not given. `GET /api/babies/{babyId}/health-entries/recent` → `[{ name, amount, unit }]`: the 5 recent names above, each with the dose of its latest entry with that name (entries at the same time ordered by id, as in the list).
- **Validation codes:** `time` `required`, `name` `required` (no name and no temperature) / `tooLong`, `amount` `outOfRange` / `invalid` (more than 2 decimals) / `nameRequired` (amount without name), `unit` `required` (amount without unit) / `invalid`, `temperature` `outOfRange` / `invalid` (more than 1 decimal), plus spec 04's common codes.
- **Adding:** the sheet opens with the time at now, an empty name, no amount, no unit, no temperature.
- **Card highlight:** "Last entry" (FR "Dernière entrée") with the time since the most recent entry (latest time among the card's loaded entries), in spec 04's highlight duration format; on the right, in an M3 display/headline typescale, that entry's name, with a label under it made of its dose and its temperature joined by " · " ("2.5 ml · 38.5 °C") when it has either; an entry without a name shows its temperature in the headline typescale and no label. With no entry at all: an empty state, "No entry logged yet" (FR « Aucune entrée enregistrée »).
- **No medical advice:** the app never suggests a dose, an interval or a maximum, never interprets a temperature, and never warns about either.
- **Renamed from Medication.** The section was first built as "Medication" and renamed Health everywhere: section key `medication` → `health` (each user's stored preference row moved with its position and visibility), colour token, API routes (`/api/medications…` removed, no alias), Core/Sql classes, table `medications` → `health_entries` (rows kept), error code, i18n.

## User stories

- As a parent, I want to log that I gave paracetamol or vitamin D drops, with the amount, in a few taps.
- As a parent, I want the medicines I give often to be one tap away, with their usual dose.
- As a parent, I want to log my baby's temperature, alone or with the medicine I gave for it.
- As a parent, I want to see how long ago the last entry was, so I don't give a dose too early.
- As my partner, I want to see what was given, the temperatures taken and when, so we don't give the same dose twice.
- As a parent, I want to fix or delete a wrong entry, and log one I forgot at an earlier time.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for health entries.

### Health card
- [x] Highlight: "Last entry" with the time since the most recent entry, updating live, in hours and minutes only ("<1m", ">24h" at the ends), and on the right that entry's name with its dose and temperature under it when it has them, or its temperature alone when it has no name.
- [x] With no entry at all, an empty state is shown.
- [x] + opens the Health sheet directly (one kind).

### Health sheet
- [x] Rows: Time (at now when adding), Name (text field), recent-name chips, Dose (amount field), Unit (unit chips), Temperature (°C field), Notes.
- [x] Save is disabled while both the name and the temperature are blank, when an amount is given without a name, when an amount is outside 0.01–1000 or has more than 2 decimals, when an amount has no unit, and when a temperature is outside 30.0–45.0 or has more than 1 decimal.
- [x] An entry with only a temperature, only a name, or both can be saved.
- [x] The recent-name chips list up to 5 distinct names, most recent first; tapping one fills the name. Without recent names (none yet, offline, error) the row is hidden.
- [x] When the name matches a recent name and the amount is empty, a suggestion row offers its last dose; Yes fills amount and unit. No suggestion when that name's latest dose had no amount. Shown when editing an entry too.
- [x] Clearing the amount saves the unit as null.

### Entry list item
- [x] `medical_services` icon, headline: the time and the name ("2:30 PM · Paracetamol"), or the time and the temperature when there is no name ("2:30 PM · 38.5 °C"); supporting text: the dose, the temperature (only when the headline shows the name) and the notes, those that exist, joined by " · " (one line, ellipsis).

### API and validation
- [x] Name or temperature required; amount without name refused; temperature range and decimals validated.
- [x] Recent names: at most 5, distinct case-insensitively (the latest spelling wins), most recently given first, each with the dose of its latest entry with that name; entries without a name are ignored; only that baby's entries.
- [x] Unit is ignored and returned null without an amount.

### Rename from Medication
- [x] The section is called Health (FR Santé) in the home card, sheet, history and settings; its key is `health`, its colour token `health`.
- [x] The API serves `/api/health-entries…` and `/api/babies/{babyId}/health-entries…`; `/api/medications…` no longer exist.
- [x] The migration renames the table to `health_entries` (keys, indexes, foreign keys and PostgreSQL's named NOT NULL constraints renamed too) and keeps every existing entry; stored section preferences for `medication` become `health` with the same position and visibility.

## Build slices

Built in 4 slices, all done; each is a commit "Spec 09 slice N: …" (`git log --grep "Spec 09 slice"`).

## Data

- **HealthEntry** (table `health_entries`): id (client UUID), baby, time (UTC), name (nullable), amount (decimal, nullable, 2 decimals), unit (nullable enum: ml, mg, drops, dose), temperature (`numeric(3,1)` °C, nullable), notes, logged by user, created at, updated at, updated by user. At least one of name and temperature is set.
- Derived, not stored: displayed dose, displayed temperature, recent names.

## UI notes

- Section colour token: `health` (red palette).
- Dose row: the amount number field (decimal keyboard, M3 outlined text field), then a Unit row (FR Unité) with the unit chips (`nala-chip-choice-row`). While an amount has no unit, the Unit row shows "Choose a unit for the amount" under the chips through `nala-chip-choice-row`'s `error`.
- Temperature row (FR Température): a number field (decimal keyboard, M3 outlined text field) with a "°C" suffix, after the Unit row and before Notes.
- Field errors: Name "Enter a name or a temperature" / "100 characters at most", Dose "0.01 to 1000" / "2 decimals at most" / "Enter a name for this dose", Temperature "30 to 45 °C" / "1 decimal at most".
- Labels: Health / Santé (section and kind), Name / Nom, Dose / Dose, Unit / Unité, Temperature / Température, units ml, mg, drops, dose (FR ml, mg, gouttes, dose), Last entry / Dernière entrée, "Use last dose: {dose}?" / « Reprendre la dernière dose : {dose} ? ».

## Out of scope

- A managed medicine list or catalogue, prescriptions, stock.
- Schedules, minimum intervals, maximum daily doses, dosage by weight, any warning or advice about doses.
- Fahrenheit, fever thresholds, temperature colours or warnings, the measuring method (rectal, ear…).
- Other health events (symptoms, doctor visits, vaccines): add them to the overview as ideas if wanted.
- Timers, live sync, mini-bar (an entry is instantaneous).
- Daily counts, totals, statistics, charts (Trends, feature 12).
