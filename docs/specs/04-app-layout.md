# 04 — App layout & section pattern

Status: in progress

## Goal

Give every activity section (Feed, Diaper, Sleep, Medication, Growth, Pump…) the same structure, so the app is predictable and each new section is mostly built from shared components. Feature specs only describe what is specific to their section, using the vocabulary defined here.

**Structure vs. styling:** the reference screenshots define the *layout and flow*. Every element itself is a standard **Material 3** component from Angular Material, used as designed, with only theme-level customization. See [Material 3 mapping](#material-3-mapping).

## Decisions

- **Only built sections are shown.** The server stores each user's preferences for every section key, in the default order. The web keeps a section registry: each feature registers its key, icon, kinds, card and history. Home and the settings list only show registered sections, so each feature spec adds its own card; until the first feature (05) exists, home shows no card.
- **Section preferences endpoints:** `GET /api/account/sections` → 200 `[{ key, visible }]` in the user's order: the default order until they save one; keys added later are appended visible, stored keys no longer known are dropped. `PUT /api/account/sections` with the whole list → 200 with it; 400 validation problem `sections`: `invalid` (not every known key exactly once, or an item without key/visible) / `noneVisible`. Any enabled member, for their own preferences only (session fallback policy).
- **Home sections in settings:** a "Home sections" section after Members & invitations, shown once at least one section is built. One list item per built section: drag handle, title, visibility switch; the switch of the last visible one is disabled. Each drop or switch saves at once (like the language and theme), shown right away and put back with a snackbar if saving fails. The web always sends all six keys: unbuilt sections keep their slot and visibility.
- **Section registry entry:** each feature registers its key, icon, its own card component (self-contained: it loads its entries for the selected baby and wraps the shared section card) and its kinds of entry (key, icon, label translation key, sheet component). Home renders the registered cards of the visible sections in the user's order, once there is a baby. The entry also registers the section's history component (self-contained like the card: it wraps the shared `nala-history-list` with a page loader for the selected baby and the `nalaSectionEntry` template, and opens entries for editing).
- **+ and entry sheets:** the shared section card handles + itself (`EntrySheetService.add`: kind picker with several kinds, the kind's sheet directly with one) and emits `changed` once a sheet saved, so the feature card reloads. The feature card opens an entry for editing with `EntrySheetService.edit(section, kind, entry)`. Each kind's sheet wraps the shared `nala-entry-sheet` frame and is opened with `{ section, kind, entry }` (entry null when adding); it closes with `{ saved }` or `{ deleted: id }`. The kind picker is a bottom sheet on every screen size.
- **Notes row:** "Notes … Add" until tapped, then an inline multi-line text field (already open when the entry has notes). Notes are at most 1000 characters.
- **Time since** (card highlights): `just now` (under 1 min), `26m ago` (under 1 h), `2h 15m ago` / `2h ago` (under 24 h), `1 day ago` / `3 days ago`. French: `à l'instant`, `il y a 26 min`, `il y a 2 h 15 min`, `il y a 1 jour` / `il y a 3 jours`. Refreshed every second from a shared clock.
- **Durations:** `45s`, `8m 30s` / `8m`, `1h 5m` / `2h` (zero parts left out, seconds left out from 1 h). French: `45 s`, `8 min 30 s`, `1 h 5 min`.
- **Entry time** (entry list item): the local time for today's entries (`2:10 PM`), `Yesterday 2:10 PM`, then date and time (`Sep 20, 2:10 PM`, with the year when it is not the current year).
- **Duration bar scale:** the bar's length is the duration divided by a fixed scale set by the section (default 1 h), capped at the full width, so bars don't change as more history loads.
- **History page:** `/history/:section`, for a registered section only (anything else → home); without a baby it goes home. M3 top app bar: back icon button to home, title "Feed history" with the selected baby's name as supporting text, no switcher. Below, the section's registered history component.
- **History paging:** a page loader is `(cursor | null) → { entries, next }`, newest first; `null` asks for the first page and `next: null` marks the last one (the cursor format is each feature's API). The next page loads when the end of the list scrolls into view (and again right away while it stays in view). While loading: a progress spinner. Without entries: an empty state ("Nothing logged yet"). A failed page shows an error with Try again, keeping the pages already loaded. A new loader (another baby) starts again from the first page. An entry edited from the history is replaced where it is, a deleted one removed; no reload.
- **Show more state:** remembered per device and per section in `localStorage` (`nala.sectionExpanded.<key>`).
- **Mini-bar: shell in 04, wired in 05.** 04 builds the shared mini-bar and a `RunningTimersService` that sections register their running-timer sources with, tested with a fake source. The first real timer (breastfeed) and the cross-device sync come with 05.

## Structure

### Top app bar
- Selected baby (name + age) with the baby switcher (03), and a settings button. Shared `nala-top-app-bar` (built in 03).

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
- [x] Home shows one card per visible section, in a single column, in the user's order.
- [x] A new user gets the default order: Feed, Sleep, Diaper, Pump, Growth, Medication; all visible.
- [x] In settings, a user can reorder sections (drag handles) and hide or show each one; at least one section must stay visible.
- [x] Order and visibility are saved per user on the server and apply on all their devices; other users are not affected.
- [x] Hiding a section only hides its card; its data is kept and still shown in the history of other members who display it.

### Section card
- [x] Every section card uses the shared section card component (header band, + button, highlight slot, show more / less, view all history).
- [x] With no entry yet, the highlight shows a section-specific empty state.
- [x] "Show more" expands up to the 10 most recent entries inline; "Show less" collapses them. The expanded state is remembered per device.
- [x] Time-since values ("26m ago", "3 days ago") update live without reloading.

### + and entry sheet
- [x] + opens the kind picker when the section has several kinds, the entry sheet directly otherwise.
- [x] The entry sheet header uses the section colour and has ×, the kind title and Save.
- [x] × closes the sheet without saving changes; if there are unsaved changes, it asks for confirmation first. (Running timers are not affected by closing — see feature specs.)
- [x] Save is disabled while required fields are missing or invalid, and shows field errors.
- [x] Tapping an entry list item opens the same sheet pre-filled, with a Delete action.
- [ ] The sheet is usable one-handed on a phone: touch targets follow M3 minimums (48 × 48 dp). *(Tests check that only default-density Material controls are used; still to be checked by hand on a phone.)*

### Mini-bar
- [ ] The mini-bar appears on every screen as soon as a timer runs, and disappears when none runs.
- [ ] It shows each running timer with a live duration and opens the matching entry sheet on tap.
- [ ] It reflects timers started or stopped from other devices within a few seconds.

### Theming
- [x] Each section has a colour token (and an "on colour" token for text/icons on it) defined in the global theme, with light and dark values. Components never hard-code these colours. Tokens: `--nala-section-<key>` / `--nala-on-section-<key>` (placeholders created in 01, `web/src/styles/_sections.scss`).

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Section preferences (server + settings).** `UserSectionPreference` entity + migration (user, key, position, visible; PK user + key; cascade on user delete). Core `SectionPreferences`: default order (feed, sleep, diaper, pump, growth, medication, all visible), stored rows merged with any new keys (appended, visible), validation (every known key exactly once, at least one visible). `GET /api/account/sections` → `[{ key, visible }]` in order; `PUT /api/account/sections` replaces the whole list → 200, 400 validation problem otherwise. Any enabled member, for themselves only. Web: `SectionPreferencesService`, a "Home sections" settings section (CDK drag list with drag handles, a visibility switch per row, the last visible one can't be turned off), limited to registered sections. Covers: default order, reorder/hide in settings, saved per user on the server, hiding keeps the data, theming (tokens from 01).
- [x] **Slice 2 — Home column, section card, entry list item.** Section registry. Home renders one shared `nala-section-card` per visible registered section, in the user's order, in a single column under the top app bar. Card: `mat-card`, header band on the section tokens, `mat-mini-fab` +, highlight slot with an empty-state slot, Show more / Show less (up to 10 entries, expanded state per device in `localStorage`), View all history. Shared `nala-entry-list-item` (kind icon, local time, summary, optional duration bar + duration, chevron). Shared ticking `NowService`, time-since and duration pipes (EN/FR). Covers: home in the user's order, the card criteria (frame, empty state, show more/less, live time-since). The frame criterion is ticked with slice 4, when View all history leads to the history page.
- [x] **Slice 3 — + button, kind picker, entry sheet frame.** + opens the shared `nala-kind-picker` (`MatBottomSheet`) with several kinds, the entry sheet directly with one. Entry sheet through `SheetService`: `nala-sheet-header` on the section colour, shared form row, suggestion row, notes row and delete action (with confirmation); × asks before discarding changes, Save disabled while invalid with field errors, entry list item opens the sheet pre-filled with Delete; 48 × 48 dp targets. Tested with a fake section. Covers: every "+ and entry sheet" criterion.
- [x] **Slice 4 — History page.** `/history/:section` (signed in, a baby required, unknown or unregistered key → home), back button, the section's entries for the selected baby newest first as entry list items, loaded page by page on scroll through the section's page loader. No totals or charts. Opened from View all history. Covers: the history part of the section card criterion.
- [ ] **Slice 5 — Running timers mini-bar (shell).** `RunningTimersService` merging the registered timer sources; shared `nala-running-timers-bar` pinned at the bottom of every screen: one list item per running timer (section icon, label, live duration, the baby's name with several babies, chevron), opens the timer's sheet on tap, hidden when none runs. Tested with a fake source. Covers: mini-bar criteria 1 and 2 (criterion 3, other devices, comes with 05's live sync).

## Material 3 mapping

Use Angular Material's M3 components as-is. Customize only through the global theme (colour tokens, typography, density); do not override component shapes, sizes or internal styles in component CSS. When no Material component exists (e.g. the section card's header band, the duration bar), build it from Material surfaces and theme tokens, following M3 guidance.

| Pattern element | Material 3 / Angular Material |
|---|---|
| Top app bar | Top app bar (`mat-toolbar`) |
| Baby switcher | Menu (`mat-menu`) opened from the baby's name in the top app bar |
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
