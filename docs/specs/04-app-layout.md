# 04 — App layout & section pattern

Status: specified

## Goal

Give every activity section (Feed, Diaper, Sleep, Medication, Growth, Pump…) the same structure, so the app is predictable and each new section is mostly built from shared components. Feature specs only describe what is specific to their section, using the vocabulary defined here.

**Structure vs. styling:** the reference screenshots (a Nara-like app) define the *layout and flow*. Every element itself is a standard **Material 3** component from Angular Material, used as designed, with only theme-level customization. See [Material 3 mapping](#material-3-mapping).

## Structure

### Top app bar
- Selected baby (name + age) with the baby switcher (03), and a settings button.

### Home
- A **single column of section cards**, one above the other, scrollable.
- The order and visibility of the cards is chosen **per user** and saved on the server (same on all their devices).

### Section card
Every section card has the same frame (shared component), filled with section-specific content:

```
┌──────────────────────────────┐
│ Feed (header band)      [+]  │  ← section colour, title, small FAB
├──────────────────────────────┤
│ [icon] Last feeding    right │  ← highlight: the section's most useful
│        26m ago     last side │     "last record" summary (per spec)
├──────────────────────────────┤
│ Show more                  ⌄ │  ← expands the recent entries inline
│ [icon] 2:10pm ▬▬▬▬ 8m30s   › │
│ [icon] 12:00pm Lunch …     › │
│ View all history           › │  ← full history page
└──────────────────────────────┘
```

- **Header band** in the section's colour (theme token), with the section title in an M3 title typescale.
- **+ button**: a Material 3 small FAB (standard M3 shape, not a circle) at the right of the header band.
- **Highlight**: the summary of the last record(s), defined by each feature spec (e.g. "Last feeding 26m ago · right last side", "Last session 3 days ago · 155 ml", latest weight/height/head size).
- **Running state**: when the section has a running timer, the highlight is replaced by the live timer with its quick controls (defined by the feature spec).
- **Show more / Show less**: expands or collapses the most recent entries (up to 10) inline in the card.
- **View all history**: opens the section's history page.

### Entry list item
Shared by the card's expanded list and the history page:
- Kind icon, local time, and a section-specific summary. When the entry has a duration, a horizontal bar whose length is proportional to the duration, followed by the duration (e.g. "8m 30s").
- A chevron; tapping the item opens the entry sheet in edit mode.

### History page
- The section's entries for the selected baby, newest first, as a plain list of entry list items, loaded page by page as the user scrolls. No totals, no charts.

### + button behaviour
- If the section has **several kinds of entry** (e.g. Feed: bottle / breastfeed / solids), + opens a **kind picker**: a bottom action sheet listing the kinds, each with its icon and label.
- If the section has **one kind** (e.g. Diaper), + opens the entry sheet directly.

### Entry sheet (add / edit form)
- A Material **bottom sheet** sliding up over the dimmed page, expanded to most of the screen height (a standard dialog on wide screens).
- Header in the section's colour, laid out like an M3 top app bar: close icon button on the left, the entry kind as title, **Save** text button on the right.
- Body as a list of **form rows** (M3 list items): label as headline, current value or action as trailing text ("Today 2:37pm", "Add") or a trailing switch. Tapping a row edits it with the standard Material control (timepicker/datepicker, text field, …).
- Optional **suggestion row** under a field (e.g. "Use last breast milk amount: 90 ml? [Yes]").
- A **Notes** row on every kind.
- In edit mode, a **Delete** action at the bottom (with confirmation).
- The same sheet is used to add and to edit an entry.

### Running timers mini-bar
- When any timer runs (breast feed now; sleep and pump later), a compact surface is **pinned at the bottom of every screen** (elevated M3 surface, like a bottom app bar), containing one M3 list item per running timer: section icon, label, live duration, and a chevron.
- When the family has more than one baby, each row also shows the baby's name, and timers of all babies are listed.
- Tapping a row opens that timer's entry sheet.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Home and order
- [ ] Home shows one card per visible section, in a single column, in the user's order.
- [ ] A new user gets the default order: Feed, Sleep, Diaper, Pump, Growth, Medication; all visible.
- [ ] In settings, a user can reorder sections (drag handles) and hide or show each one; at least one section must stay visible.
- [ ] Order and visibility are saved per user on the server and apply on all their devices; other users are not affected.
- [ ] Hiding a section only hides its card; its data is kept and still shown in the history of other members who display it.

### Section card
- [ ] Every section card uses the shared section card component (header band, + button, highlight slot, show more / less, view all history).
- [ ] With no entry yet, the highlight shows a section-specific empty state.
- [ ] "Show more" expands up to the 10 most recent entries inline; "Show less" collapses them. The expanded state is remembered per device.
- [ ] Time-since values ("26m ago", "3 days ago") update live without reloading.

### + and entry sheet
- [ ] + opens the kind picker when the section has several kinds, the entry sheet directly otherwise.
- [ ] The entry sheet header uses the section colour and has ×, the kind title and Save.
- [ ] × closes the sheet without saving changes; if there are unsaved changes, it asks for confirmation first. (Running timers are not affected by closing — see feature specs.)
- [ ] Save is disabled while required fields are missing or invalid, and shows field errors.
- [ ] Tapping an entry list item opens the same sheet pre-filled, with a Delete action.
- [ ] The sheet is usable one-handed on a phone: touch targets follow M3 minimums (48 × 48 dp).

### Mini-bar
- [ ] The mini-bar appears on every screen as soon as a timer runs, and disappears when none runs.
- [ ] It shows each running timer with a live duration and opens the matching entry sheet on tap.
- [ ] It reflects timers started or stopped from other devices within a few seconds.

### Theming
- [ ] Each section has a colour token (and an "on colour" token for text/icons on it) defined in the global theme, with light and dark values. Components never hard-code these colours.

## Material 3 mapping

Use Angular Material's M3 components as-is. Customize only through the global theme (colour tokens, typography, density); do not override component shapes, sizes or internal styles in component CSS. When no Material component exists (e.g. the section card's header band, the duration bar), build it from Material surfaces and theme tokens, following M3 guidance.

| Pattern element | Material 3 / Angular Material |
|---|---|
| Top app bar | Top app bar (`mat-toolbar`) |
| Section card | Card (`mat-card`, elevated or filled) |
| + button | Small FAB (`mat-mini-fab`) |
| Show more / View all history | Text button / list item with trailing icon |
| Entry list item | List item (`mat-list-item`) with leading icon, headline, supporting text, trailing icon |
| Kind picker | Bottom sheet (`MatBottomSheet`) with a list of items |
| Entry sheet | Bottom sheet on phones, dialog (`MatDialog`) on wide screens |
| Form row | List item; editing through `mat-form-field`, `mat-timepicker`, `mat-datepicker` |
| Single choice among 2–4 options (e.g. milk type) | Segmented button (`mat-button-toggle-group`) |
| Optional / multi choice (e.g. meal type, reaction, wet/dirty/dry) | Filter chips (`mat-chip-listbox`) |
| On/off field (e.g. diaper rash) | Switch (`mat-slide-toggle`) |
| Primary / secondary actions | Filled / tonal / outlined / text buttons per M3 emphasis |
| Confirmation (delete, unsaved changes) | Dialog |
| Feedback after save / offline queued | Snackbar |
| Section reorder | Drag and drop (CDK) list with drag handle icons |
| Duration bar | Plain bar using theme tokens (not a progress indicator) |

## Data

- **User section preference:** user, section key, position, visible.
- Section keys: `feed`, `sleep`, `diaper`, `pump`, `growth`, `medication` (extended as features are added).

## UI notes — shared components

Section card, entry list item (with duration bar), kind picker sheet, entry sheet (header, form row, suggestion row, notes row, delete action), time picker row, duration field, running timers mini-bar, empty state.

## What each feature spec must define

- Kinds of entry (and their icons) and whether + opens a kind picker.
- Card highlight (normal and running state) and empty state.
- Entry list item summary per kind.
- Entry sheet rows per kind, defaults and suggestion rows.

## Out of scope

- Photos on entries (decided: never).
- Totals, statistics and charts in cards or history.
- Home widgets other than section cards.
