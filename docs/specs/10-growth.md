# 10 — Growth

Status: done

Layout vocabulary (section card, kind picker, entry sheet, entry list item…) is defined in [04 — App layout](04-app-layout.md). Growth has no timer, so spec 04's Timers rules, the mini-bar and `GET /api/live` don't apply; this spec only adds what is specific to Growth.

## Goal

Log the selected baby's measurements (weight, length, head circumference) and milestones over time, starting from the birth measurements of the baby profile, and see the latest value of each measure at a glance. Raw logging only: no percentiles, curves or trends.

## Kinds

| Kind | Icon | Fields |
|------|------|--------|
| Measurement | `monitor_weight` | date, weight (kg), length (cm), head circumference (cm), notes |
| Milestone | `celebration` | date, milestone (preset or custom title), notes |

Two kinds, so + opens the kind picker (Measurement, Milestone). Section icon: `monitor_weight`.

## Decisions

- **One entity with a kind**, as Feed: a growth entry is a measurement or a milestone, with the fields of the other kind null. The section's endpoints are its own (activity model).
- **Date only, no time.** Measurements and milestones are dated like the birth date (a calendar date, no time zone; the "times stored in UTC" rule is about instants). The date is not in the future (API: not after today in UTC+14, as the birth date in 03; web: not after the device's local today) and not before the baby's birth date.
- **Measurement values, each optional, at least one:**
  - **Weight** typed in **kg with up to 3 decimals** ("4.250"), stored as **whole grams** like the birth weight. Range 0.3–30 kg (300–30000 g).
  - **Length** in cm, one decimal, 20–130 cm.
  - **Head circumference** in cm, one decimal, 15–60 cm.
  - The API takes and returns `weightG`, `lengthCm`, `headCircumferenceCm` (same names and precision as the baby's birth fields); the web converts kg ↔ g.
- **Milestones:** a single choice among presets, as chips (shared `nala-chip-choice-row`): `firstSmile`, `firstLaugh`, `holdsHead`, `rollsOver`, `sitsUp`, `crawls`, `firstTooth`, `standsUp`, `firstSteps`, `firstWord`, and `custom`. With `custom`, a Title field shows (required, 1–100 characters once trimmed; "Enter a title" / "100 characters at most"); with a preset, the title is ignored and stored null. A preset can be logged more than once (each tooth, say). The chips are not clearable (tapping the chosen one keeps it). A title typed under Other stays while the sheet is open, so switching to a preset and back brings it back; it is only sent with Other.
- **Birth is the first point.** The birth weight / length / head circumference stay on the baby profile (03), never copied into entries. They show as:
  - the fallback of the card highlight for any measure that has no entry yet;
  - a **Birth** item at the end of the history list (after the last page, not while loading nor after a load error), when the baby has at least one birth measurement: `monitor_weight` icon, headline the birth date · "Birth", supporting text as a measurement. With no entry, the history shows the Birth item alone, without the empty state. Tapping it opens the baby's profile form (03's baby sheet); it can't be deleted from here. A profile saved there updates the app's babies at once (ages, card highlight, Birth item); a baby the admin deletes there is dropped and the next baby is shown.
- **Order:** newest date first; entries on the same date by creation time, newest first, then id.
- **Growth endpoints:** `POST /api/growth-entries` with `{ id, babyId, kind, date, notes, …kind fields }` (measurement: `weightG`, `lengthCm`, `headCircumferenceCm`; milestone: `milestone`, `title`; the fields of the other kind are ignored and returned null) → 201; existing id → 200 with the stored entry unchanged (idempotent re-send). `PUT /api/growth-entries/{id}` replaces every field of the entry's kind (the baby and the kind never change) → 200. `DELETE /api/growth-entries/{id}` → 204; `GET /api/growth-entries/{id}` → 200; unknown → 404 `{ code: "growthEntryNotFound" }`. `GET /api/babies/{babyId}/growth-entries?cursor=&limit=` → `{ entries, next }` in the order above, 20 per page by default, 1–50; malformed cursor → 400 `cursor: invalid`. `GET /api/babies/{babyId}/growth-entries/latest` → `{ weight, length, headCircumference }`, each `{ value, date, birth: bool }` from the most recent measurement that has it (newest date, then creation), or from the birth fields (`date` = birth date, `birth: true`), or null. Unknown baby → 404 `{ code: "babyNotFound" }`. Each entry carries `loggedBy` and `updatedBy` (`{ id, displayName }`).
- **Validation codes:** `id` / `babyId` `required`, `kind` `required` / `invalid`, `date` `required` / `inFuture` / `beforeBirth`, `weightG` `outOfRange` / `invalid` (not whole), `lengthCm` / `headCircumferenceCm` `outOfRange` / `invalid` (more than one decimal), `measurements` `required` (measurement with no value), `milestone` `required` / `invalid`, `title` `required` (custom, blank) / `tooLong`, `notes` `tooLong` (spec 04, 1000).
- **Adding:** a sheet opens with the date at today, every value empty (measurement) or no milestone chosen (milestone). Save is the only action (no timer, so × simply discards).
- **Measurement sheet values:** the weight field takes kg as typed and shows a saved weight back as a plain number ("4.25"); "4.250 kg" (3 decimals) is the list item and highlight format. Each field shows its range under it when invalid ("0.3 to 30 kg, 3 decimals at most"); once a value was touched and none is left, the row says "Enter a weight, a length or a head circumference".
- **Card highlight:** the latest of each measure side by side, from `…/growth-entries/latest`: Weight ("4.250 kg"), Length ("55.5 cm"), Head ("38.0 cm"), each value in an M3 headline typescale with its label above it and its date under it (entry date format: "Today", "Yesterday", "Sep 28", with the year when not the current one; "Birth" when it comes from the profile). A measure with no value shows "—". The highlight reloads when the card reloads (after a save). A milestone never changes the highlight. With no value at all (no measurement, no birth measurement): the empty state, even when milestones exist. When the latest values can't be loaded (offline), the card lists its entries without a highlight nor the empty state.
- **Card entries:** the shared card rules apply, an entry's date counting as its local midnight for the 24-hour window (so Show more rarely appears). The Birth item is not listed on the card.
- **Offline:** add, edit and delete go through the shared device queue (spec 05 Offline), with the same snackbars. The highlight and the Birth item need the network (reading needs the network, overview).
- **No percentiles, curves, charts or trend analysis**, and no reminders, notifications or photos, ever.

## User stories

- As a parent, I want to type my baby's weight from the scale or the doctor's visit in kg, with length and head circumference when I have them.
- As a parent, I want to see the latest weight, length and head circumference at a glance, and their date.
- As a parent, I want to note milestones (first smile, first tooth, first steps…) or one of my own, with the day they happened.
- As a parent, I want the birth measurements to appear as the start of the history, without typing them again.
- As a parent, I want to fix or delete a wrong entry.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Growth card
- [x] + opens the kind picker (Measurement, Milestone).
- [x] Highlight: Weight, Length and Head side by side, each the latest value from a measurement or, without one, from the birth profile, with its date ("Birth" for the profile); "—" for a measure with no value.
- [x] With no measurement and no birth measurement, the empty state is shown, milestones or not.
- [x] The highlight is refreshed after an entry is saved or deleted.

### Measurement sheet
- [x] Rows: Date (date only, today when adding), Weight kg / Length cm / Head cm (one row of three number fields, decimal keyboard), Notes.
- [x] Save is disabled when no value is filled, when a value is out of range or too precise (weight 0.3–30 kg, 3 decimals; length 20–130 cm, 1 decimal; head 15–60 cm, 1 decimal), and when the date is in the future or before the baby's birth date.
- [x] Weight typed in kg is saved as grams ("4.25" → 4250) and shown back in kg with 3 decimals ("4.250") in the list items and the highlight (the sheet's number field shows the plain number, "4.25").
- [x] An existing measurement opens with its values; Save replaces them; × discards the form edits; Delete deletes it after confirmation.

### Milestone sheet
- [x] Rows: Milestone (preset chips + Other), Title (only while Other is chosen), Date (today when adding), Notes.
- [x] Save is disabled until a milestone is chosen, and with Other until the title is filled (1–100 characters); same date rules as a measurement.
- [x] Choosing a preset after Other hides the title and saves it as null.
- [x] An existing milestone opens with its values; Save replaces them; × discards; Delete deletes it after confirmation.

### Entry list item
- [x] Headline: the entry date and the baby's age on that date ("Sep 28 · 6 weeks 2 days", shared `BabyAgePipe` from 03).
- [x] Measurement: `monitor_weight` icon; supporting text: the filled values ("4.250 kg · 55.5 cm · Head 38.0 cm", empty ones left out).
- [x] Milestone: `celebration` icon; supporting text: the preset's label or the custom title.
- [x] History ends with the Birth item when the baby has a birth measurement: birth date · "Birth", the birth values as a measurement; tapping it opens the baby's profile form.
- [x] Entries logged by a deleted account still show that person's display name.

### API and validation
- [x] Create, idempotent re-send, update, delete, get, paged list (date, then creation, newest first; cursor; limit 1–50) with the codes above.
- [x] Fields of the other kind are ignored and returned null; a preset milestone's title is returned null.
- [x] Latest: each measure from its most recent measurement, else from the birth fields with `birth: true`, else null; only that baby's entries.
- [x] Any member can edit or delete any entry; changes are saved with who edited it and when.
- [x] Growth entries are deleted with their baby (03).

### Offline
- [x] With no network, adding, editing and deleting an entry are queued on the device and applied when back online; re-sending is idempotent (client UUIDs).

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Measurements, card and history.** `GrowthEntry` entity + migration (client UUID, baby FK with cascade, kind, date, weight g, length cm, head circumference cm, notes, logged by, created at, updated at/by; nullable milestone columns come with slice 2). Core `GrowthEntryService` (validation incl. `beforeBirth`, create idempotent, update, delete, paged list, latest with birth fallback) reusing `Nala.Core/Entries` and the baby's measurement rules (`BabyFields`) where they match. Endpoints `POST/PUT/DELETE/GET /api/growth-entries…`, `GET /api/babies/{babyId}/growth-entries` and `…/latest`. Web: `growth` section registered (Measurement kind only for now, so + opens its sheet), `GrowthService`, date-only `nala-time-row`, Measurement sheet, card highlight (three measures, birth fallback, empty state), entry list item with the age, history; add / edit / delete through the shared offline queue. Covers: card (except the kind picker), Measurement sheet, measurement list item, API and validation (measurement part), offline.
- [x] **Slice 2 — Milestones.** Milestone and title columns + migration, Core validation. Web: Milestone kind registered (+ now opens the kind picker), Milestone sheet (preset chips, Other + title), milestone list item. Covers: the kind picker, Milestone sheet, milestone list item, the milestone API criteria.
- [x] **Slice 3 — Birth in the history.** Web: the Birth item appended after the last history page when the baby has a birth measurement (shared `nala-history-list` end template `nalaHistoryEnd`), opening the baby's profile form. Covers: the Birth item criterion.

## Data

- **GrowthEntry:** id (client UUID), baby, kind (measurement / milestone), date (date only), weight g (int, nullable), length cm (decimal, one decimal, nullable), head circumference cm (decimal, one decimal, nullable), milestone (nullable enum), title (nullable), notes, logged by user, created at, updated at, updated by user.
- Birth measurements stay on the baby (03), not duplicated as entries.
- Derived, not stored: weight in kg, age at the entry's date, latest values.
- Growth entries are deleted with their baby (03).

## UI notes

- Section colour token: `growth` (green palette, already in `_sections.scss`), with its container tokens.
- **`nala-time-row` gets a date-only mode** (`dateOnly` input: datepicker only, value "Today" / "Sep 28", `Date` at local midnight in the form; the service sends `yyyy-MM-dd`). No new row component.
- **`nala-number-fields-row` gets per-field suffix, bounds, step and error** (each `NumberField` may carry its own `suffix`, `min`, `max`, `step` and `error`; the row-level inputs stay the defaults; a decimal `step` brings the decimal keyboard), for kg / cm / cm in one row with their own range messages. Pump's Left / Right ml keep working unchanged.
- **`nala-entry-list-item` gets `dateOnly`**: the headline shows the entry's date ("Today", "Sep 28") instead of its time.
- **`nala-history-list` gets an end template** (`nalaHistoryEnd`, spec 04) for the Birth item; the measurement summary is the shared `nalaMeasurementSummary` pipe, used by entries and the Birth item.
- **`nala-section-card` gets an `empty` input**: whether the section has nothing to highlight; by default (null) the card decides from its entries as before. Growth sets it from the latest values, so the empty state follows the measurements and the birth profile, not the entries.
- Entry date format (list item headline, highlight dates): the date part of spec 04's entry time ("Today", "Yesterday", "Sep 28", year when not current), from the shared entry-time code, not a copy (`nalaEntryDate`, next to `nalaEntryTime`).
- The Growth card highlight is the section's own content inside the shared section card's highlight slot (three columns, label / value / date).
- Reused: section card, kind picker, entry sheet, `nala-time-row`, `nala-number-fields-row`, `nala-chip-choice-row`, notes row, entry list item, history list, empty state, confirm dialog, `BabyAgePipe`, baby sheet (03), device queue.
- Labels: Growth / Croissance, Measurement / Mesure, Milestone / Étape, Weight / Poids, Length / Taille, Head / Périmètre crânien (short "PC" in summaries), Birth / Naissance, Other / Autre, Title / Titre. Milestones: First smile / Premier sourire, First laugh / Premier rire, Holds head up / Tient sa tête, Rolls over / Se retourne, Sits up / Tient assis, Crawls / Marche à quatre pattes, First tooth / Première dent, Stands up / Se met debout, First steps / Premiers pas, First word / Premier mot.
- All text through i18n (EN/FR).

## Out of scope

- Percentiles, WHO curves, growth charts, trend or velocity analysis (decided: raw logging only).
- Imperial units (metric only, overview).
- Times on growth entries (date only).
- Other measures (temperature, BMI…), milestone photos.
- Reminders and notifications, photos (never).

## Open questions

- None so far.
