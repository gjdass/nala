# 10 — Growth

Status: done

Builds on [04 — App layout](04-app-layout.md): the section pattern, the entry API conventions and the offline queue apply. Growth has no timer, so 04's Timers part doesn't. This spec only adds what is specific to Growth.

## Goal

Log the selected baby's measurements (weight, length, head circumference) and milestones over time, starting from the birth measurements of the baby profile, and see the latest value of each measure at a glance. Raw logging only: no percentiles, curves or trends.

## Kinds

| Kind | Icon | Fields |
|------|------|--------|
| Measurement | `monitor_weight` | date, weight (kg), length (cm), head circumference (cm), notes |
| Milestone | `celebration` | date, milestone (preset or custom title), notes |

Two kinds, so + opens the kind picker (Measurement, Milestone). Section icon: `monitor_weight`.

## Decisions

- **One entity with a kind**, as Feed: a growth entry is a measurement or a milestone, with the fields of the other kind null.
- **Date only, no time.** Measurements and milestones are dated like the birth date (a calendar date, no time zone; the "times stored in UTC" rule is about instants). The date may be in the future (spec 04) but not before the baby's birth date.
- **Measurement values, each optional, at least one:**
  - **Weight** typed in **kg with up to 3 decimals** ("4.250"), stored as **whole grams** like the birth weight. Range 0.3–30 kg (300–30000 g).
  - **Length** in cm, one decimal, 20–130 cm.
  - **Head circumference** in cm, one decimal, 15–60 cm.
  - The API takes and returns `weightG`, `lengthCm`, `headCircumferenceCm` (same names and precision as the baby's birth fields); the web converts kg ↔ g.
- **Milestones:** a single choice among presets, as chips (shared `nala-chip-choice-row`): `firstSmile`, `firstLaugh`, `holdsHead`, `rollsOver`, `sitsUp`, `crawls`, `firstTooth`, `standsUp`, `firstSteps`, `firstWord`, and `custom`. With `custom`, a Title field shows (required, 1–100 characters once trimmed; "Enter a title" / "100 characters at most"); with a preset, the title is ignored and stored null. A preset can be logged more than once (each tooth, say). The chips are not clearable (tapping the chosen one keeps it). A title typed under Other stays while the sheet is open, so switching to a preset and back brings it back; it is only sent with Other.
- **Birth is the first point.** The birth weight / length / head circumference stay on the baby profile (03), never copied into entries. They are the fallback of the card highlight for any measure that has no entry yet. They are not listed as an entry, on the card nor in History (spec 11).
- **Order:** newest date first; entries on the same date by creation time, newest first, then id.
- **Endpoints** (spec 04 entry API conventions): resource `/api/growth-entries`, body `{ id, babyId, kind, date, notes, …kind fields }` (measurement: `weightG`, `lengthCm`, `headCircumferenceCm`; milestone: `milestone`, `title`), `PUT` replaces every field of the entry's kind, list in the order above, not found `growthEntryNotFound`. `GET /api/babies/{babyId}/growth-entries/latest` → `{ weight, length, headCircumference }`, each `{ value, date, birth: bool }` from the most recent measurement that has it (newest date, then creation), or from the birth fields (`date` = birth date, `birth: true`), or null.
- **Validation codes:** `kind` `required` / `invalid`, `date` `required` / `beforeBirth`, `weightG` `outOfRange` / `invalid` (not whole), `lengthCm` / `headCircumferenceCm` `outOfRange` / `invalid` (more than one decimal), `measurements` `required` (measurement with no value), `milestone` `required` / `invalid`, `title` `required` (custom, blank) / `tooLong`, plus spec 04's common codes.
- **Adding:** a sheet opens with the date at today, every value empty (measurement) or no milestone chosen (milestone).
- **Measurement sheet values:** the weight field takes kg as typed and shows a saved weight back as a plain number ("4.25"); "4.250 kg" (3 decimals) is the list item and highlight format. Each field shows its range under it when invalid ("0.3 to 30 kg, 3 decimals at most"); once a value was touched and none is left, the row says "Enter a weight, a length or a head circumference".
- **Card highlight:** the latest of each measure side by side, from `…/growth-entries/latest`: Weight ("4.250 kg"), Length ("55.5 cm"), Head ("38.0 cm"), each value in an M3 headline typescale with its label above it and its date under it (spec 04's entry date format; "Birth" when it comes from the profile). A measure with no value shows "—". The highlight reloads when the card reloads (after a save). A milestone never changes the highlight. With no value at all (no measurement, no birth measurement): the empty state, even when milestones exist (the card's `empty` input). When the latest values can't be loaded (offline), the card lists its entries without a highlight nor the empty state.
- **Card entries:** spec 04's card rules apply, an entry's date counting as its local midnight for the 24-hour window (so Show more rarely appears).
- **Offline:** the highlight needs the network (reading needs the network, overview).
- **No percentiles, curves, charts or trend analysis.**

## User stories

- As a parent, I want to type my baby's weight from the scale or the doctor's visit in kg, with length and head circumference when I have them.
- As a parent, I want to see the latest weight, length and head circumference at a glance, and their date.
- As a parent, I want to note milestones (first smile, first tooth, first steps…) or one of my own, with the day they happened.
- As a parent, I want the birth measurements to count as the first values, without typing them again.
- As a parent, I want to fix or delete a wrong entry.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
- [x] Spec 04's shared entry criteria hold for growth entries (list ordered by date, then creation).

### Growth card
- [x] + opens the kind picker (Measurement, Milestone).
- [x] Highlight: Weight, Length and Head side by side, each the latest value from a measurement or, without one, from the birth profile, with its date ("Birth" for the profile); "—" for a measure with no value.
- [x] With no measurement and no birth measurement, the empty state is shown, milestones or not.
- [x] The highlight is refreshed after an entry is saved or deleted.

### Measurement sheet
- [x] Rows: Date (date only, today when adding), Weight kg / Length cm / Head cm (one row of three number fields, decimal keyboard), Notes.
- [x] Save is disabled when no value is filled, when a value is out of range or too precise (weight 0.3–30 kg, 3 decimals; length 20–130 cm, 1 decimal; head 15–60 cm, 1 decimal), and when the date is before the baby's birth date.
- [x] Weight typed in kg is saved as grams ("4.25" → 4250) and shown back in kg with 3 decimals ("4.250") in the list items and the highlight (the sheet's number field shows the plain number, "4.25").

### Milestone sheet
- [x] Rows: Milestone (preset chips + Other), Title (only while Other is chosen), Date (today when adding), Notes.
- [x] Save is disabled until a milestone is chosen, and with Other until the title is filled (1–100 characters); same date rules as a measurement.
- [x] Choosing a preset after Other hides the title and saves it as null.

### Entry list item
- [x] Headline: the entry date and the baby's age on that date ("Sep 28 · 6 weeks 2 days", shared `BabyAgePipe` from 03).
- [x] Measurement: `monitor_weight` icon; supporting text: the filled values ("4.250 kg · 55.5 cm · Head 38.0 cm", empty ones left out).
- [x] Milestone: `celebration` icon; supporting text: the preset's label or the custom title.

### API and validation
- [x] Fields of the other kind are ignored and returned null; a preset milestone's title is returned null.
- [x] Latest: each measure from its most recent measurement, else from the birth fields with `birth: true`, else null; only that baby's entries.

## Build slices

Built in 3 slices, all done; each is a commit "Spec 10 slice N: …" (`git log --grep "Spec 10 slice"`).

## Data

- **GrowthEntry:** id (client UUID), baby, kind (measurement / milestone), date (date only), weight g (int, nullable), length cm (decimal, one decimal, nullable), head circumference cm (decimal, one decimal, nullable), milestone (nullable enum), title (nullable), notes, logged by user, created at, updated at, updated by user.
- Birth measurements stay on the baby (03), not duplicated as entries.
- Derived, not stored: weight in kg, age at the entry's date, latest values.

## UI notes

- Section colour token: `growth` (green palette).
- Shared components extended for this feature (spec 04): `nala-time-row` `dateOnly` (the service sends `yyyy-MM-dd`), `nala-number-fields-row` per-field suffix / bounds / step / error, `nala-entry-list-item` `dateOnly`, `nala-section-card` `empty` input, `nalaEntryDate`.
- The measurement summary is the shared `nalaMeasurementSummary` pipe.
- The Growth card highlight is the section's own content inside the shared section card's highlight slot (three columns, label / value / date).
- Labels: Growth / Croissance, Measurement / Mesure, Milestone / Étape, Weight / Poids, Length / Taille, Head / Périmètre crânien (short "PC" in summaries), Birth / Naissance, Other / Autre, Title / Titre. Milestones: First smile / Premier sourire, First laugh / Premier rire, Holds head up / Tient sa tête, Rolls over / Se retourne, Sits up / Tient assis, Crawls / Marche à quatre pattes, First tooth / Première dent, Stands up / Se met debout, First steps / Premiers pas, First word / Premier mot.

## Out of scope

- Percentiles, WHO curves, growth charts, trend or velocity analysis (decided: raw logging only).
- Imperial units (metric only, overview).
- Times on growth entries (date only).
- Other measures (temperature, BMI…), milestone photos.
