# 04 — App layout & section pattern

Status: in progress

## Goal

Give every activity section (Feed, Diaper, Sleep, Medication, Growth, Pump…) the same structure, so the app is predictable and each new section is mostly built from shared components. Feature specs only describe what is specific to their section, using the vocabulary defined here.

**Structure vs. styling:** the reference screenshots define the *layout and flow*. Every element itself is a standard **Material 3** component from Angular Material, used as designed, with only theme-level customization. See [Material 3 mapping](#material-3-mapping).

## Decisions

- **Only built sections are shown.** The server stores each user's preferences for every section key, in the default order. The web keeps a section registry: each feature registers its key, icon, kinds, card and history. Home and the settings list only show registered sections, so each feature spec adds its own card; until the first feature (05) exists, home shows no card.
- **Section preferences endpoints:** `GET /api/account/sections` → 200 `[{ key, visible }]` in the user's order: the default order until they save one; keys added later are appended visible, stored keys no longer known are dropped. `PUT /api/account/sections` with the whole list → 200 with it; 400 validation problem `sections`: `invalid` (not every known key exactly once, or an item without key/visible) / `noneVisible`. Any enabled member, for their own preferences only (session fallback policy).
- **Home sections in settings:** a "Home sections" section after Members & invitations, shown once at least one section is built. One list item per built section: drag handle, title, visibility switch; the switch of the last visible one is disabled. Each drop or switch saves at once (like the language and theme), shown right away and put back with a snackbar if saving fails. The web always sends all six keys: unbuilt sections keep their slot and visibility.
- **Section registry entry:** each feature registers its key, icon, its own card component (self-contained: it loads its entries for the selected baby and wraps the shared section card) and its kinds of entry (key, icon, label translation key, sheet component). Home renders the registered cards of the visible sections in the user's order, once there is a baby. The entry also registers the section's history component (self-contained like the card: it wraps the shared `nala-history-list` with a page loader for the selected baby and the `nalaSectionEntry` template, and opens entries for editing). The registry is part of the initial bundle, so it holds **loaders** for these components (`loadCard`, `loadHistory`, each kind's `loadSheet`: `() => import(…)`), never the components themselves: home and the history page render them through the `nalaLoadComponent` pipe, and `EntrySheetService` loads a kind's sheet before opening it.
- **+ and entry sheets:** while the section has no live entry, the shared section card handles + itself (`EntrySheetService.add`: kind picker with several kinds, the kind's sheet directly with one) and emits `changed` once a sheet saved, so the feature card reloads. The feature card opens an entry for editing with `EntrySheetService.edit(section, kind, entry)`. Each kind's sheet wraps the shared `nala-entry-sheet` frame and is opened with `{ section, kind, entry }` (entry null when adding); it closes with `{ saved }` or `{ deleted: id }`. The kind picker is a bottom sheet on every screen size.
- **Notes row:** "Notes … Add" until tapped, then an inline multi-line text field (already open when the entry has notes). Notes are at most 1000 characters.
- **Time since** (card highlights): `just now` (under 1 min), `26m ago` (under 1 h), `2h 15m ago` / `2h ago` (under 24 h), `1 day ago` / `3 days ago`. French: `à l'instant`, `il y a 26 min`, `il y a 2 h 15 min`, `il y a 1 jour` / `il y a 3 jours`. Refreshed every second from a shared clock.
- **Durations:** `45s`, `8m 30s` / `8m`, `1h 5m` / `2h` (zero parts left out, seconds left out from 1 h). French: `45 s`, `8 min 30 s`, `1 h 5 min`.
- **Entry time** (entry list item): the local time for today's entries (`2:10 PM`), `Yesterday 2:10 PM`, then date and time (`Sep 20, 2:10 PM`, with the year when it is not the current year).
- **Entry list item layout:** every entry list item is the same two-line M3 list item, whatever the section or kind, so rows have the same height: the headline is the local time, then the optional label after " · " ("4:23 PM · Snack · Liked"); the supporting text is one line, aligned with the headline, cut with an ellipsis when too long. No duration bar: a duration is written in the summary by the feature ("Total 8m 30s · L 5m · R 3m 30s").
- **Card entries:** folded, the card lists the **3 most recent entries** under the highlight. **Show more** lists every entry that started in the **last 24 hours** (never fewer than the 3 already shown); it is hidden when the 24 hours hold no more than those 3. **All activities** opens the section's history page. The card loads its entries through the section's page loader with a shared helper: page after page until an entry is older than 24 h or the last page (the window is taken when the card loads, it doesn't move while the page stays open).
- **Section colours on card buttons:** the + / live timer small FAB uses `--nala-section-<key>-container` / `--nala-on-section-<key>-container` (a lighter tone of the section colour in light mode, a darker one in dark mode); the Show more / Show less text button uses `--nala-section-<key>`. Both are applied through the global theme, not component CSS: `mat.fab-overrides` on `.nala-section-fab` and `mat.button-overrides` on `.nala-section-text-button` (in `_sections.scss`), reading `--nala-section-container` / `--nala-on-section-container` / `--nala-section-accent`, which the section card sets to its section's tokens. Scoped to these two buttons, so buttons projected by features keep their own colours. Container tones: palette 90 / on 10 in light mode, 30 / on 90 in dark mode.
- **History page:** `/history/:section`, for a registered section only (anything else → home); without a baby it goes home. M3 top app bar: back icon button to home, title "Feed history" with the selected baby's name as supporting text, no switcher. Below, the section's registered history component.
- **History paging:** a page loader is `(cursor | null) → { entries, next }`, newest first; `null` asks for the first page and `next: null` marks the last one (the cursor format is each feature's API). The next page loads when the end of the list scrolls into view (and again right away while it stays in view). While loading: a progress spinner. Without entries: an empty state ("Nothing logged yet"). A failed page shows an error with Try again, keeping the pages already loaded. A new loader (another baby) starts again from the first page. An entry edited from the history is replaced where it is, a deleted one removed; no reload.
- **Show more state:** remembered per device and per section in `localStorage` (`nala.sectionExpanded.<key>`).
- **Mini-bar: shell in 04, wired in 05.** 04 builds the shared mini-bar and a `RunningTimersService` that sections register their running-timer sources with, tested with a fake source. The first real timer (breastfeed) and the cross-device sync come with 05.
- **Running timer sources:** a feature with timers provides a source through `RUNNING_TIMER_SOURCES`: a signal of its live entries, each with an id, section, kind and the live entry (tapping it opens `EntrySheetService.edit(section, kind, entry)`), the baby, a label translation key (+ params) and its live duration in seconds at a given time. `RunningTimersService` merges them in registration order. The duration uses the spec 04 duration format. The app shell loads the mini-bar only once a timer runs (deferred, out of the initial bundle).
- **Timers (every section with timers: Feed's breastfeed now, Sleep and Pump later).** An entry with timers is either **live** (one of its timers runs) or **not live**. There is no paused, in-progress or finished state: stopping the timers makes it an ordinary entry, and Start on it (from its sheet) makes it live again.
  - The entry exists from its first Start, and is listed at once (card and history) with its live total.
  - Only live entries show the section's running state on the card, the timer button, a mini-bar row, and are synced live between devices.
  - At most one live entry per baby and section: starting a timer while another entry of that baby and section is live is refused (409) and the sheet opens the live one. Exception: a Start sent from a device's offline queue is kept anyway (two live entries; the card, the timer button and + show the oldest; the mini-bar lists both).
  - **Save saves the form and never starts or stops a timer:** a live entry stays live after Save.
  - **× discards what Save would have saved.** On a sheet opened to add, it deletes the entry its Start created (after the unsaved-changes confirmation: a Start counts as a change). On an existing entry it discards the form edits only; timer taps made in the sheet stay (they are live actions, already seen by other devices).
  - The end time is the end of the last timed segment, empty while live.
  - Warnings about an entry live for too long ("Still feeding?") are defined per feature.
- **Live timer button:** while the section has a live entry for the selected baby, the card's + is replaced by a **timer button** (same small FAB and colours, `timer` icon, labelled "Open live <section>") that opens that entry's sheet (`EntrySheetService.edit`). Other kinds can be added again once the timers are stopped. The card finds the live entry through `RunningTimersService` (section + baby), so a new timer section gets it without its own code.
- **Bottom navigation bar:** a floating navigation bar on every signed-in screen, never on the signed-out ones (setup, login, invitation, password reset). Four destinations, in this order: **Dashboard** (`/`, home), **History** (`/history`), **Trends** (`/trends`), **Settings** (`/settings`), each with an icon and a label, the current one marked with the M3 active indicator. History and Trends are placeholders for now ("Coming soon" empty state; their content is features 11 and 12). The settings button leaves the top app bar, and the settings page loses its back link (it is a destination).

## Structure

### Top app bar
- Selected baby (name + age) with the baby switcher (03). Shared `nala-top-app-bar` (built in 03). Settings is reached from the bottom navigation bar.

### Bottom navigation bar
- Floating, fixed at the bottom of the screen above the safe area: not full width (16 px from each side, at most 420 px wide, centred), fully rounded ends, a translucent surface with the page blurred behind it (`backdrop-filter`), like the iOS "liquid glass" bars.
- Four destinations: Dashboard, History, Trends, Settings (icon + label; the current one with the active indicator pill).
- Pages keep enough bottom padding that their last element can scroll above the bar.

### Home
- A **single column of section cards**, one above the other, scrollable.
- The order and visibility of the cards is chosen **per user** and saved on the server (same on all their devices).

### Section card
Every section card has the same frame (shared component), filled with section-specific content:

```
┌──────────────────────────────┐
│ Feed (header band)      [+]  │  ← section colour, title, small FAB
├──────────────────────────────┤     (timer button while an entry is live)
│ [icon] Last feeding    Right │  ← highlight: the section's most useful
│        26m ago     last side │     "last record" summary (per spec)
├──────────────────────────────┤
│ [icon] 4:23 PM · Snack …   › │  ← the 3 most recent entries
│ [icon] 4:23 PM             › │
│        Breast milk · 90 ml   │
│ [icon] 1:30 PM             › │
│        Total 5m · L 1m · R 4m│
│ Show more                  ⌄ │  ← the last 24 hours
│ All activities             › │  ← full history page
└──────────────────────────────┘
```

- **Header band** in the section's colour (theme token), with the section title in an M3 title typescale.
- **+ button**: a Material 3 small FAB (standard M3 shape, not a circle) at the right of the header band, in the section's container colours. While the section has a live entry it becomes the **timer button**, which opens that entry.
- **Highlight**: the summary of the last record(s), defined by each feature spec (e.g. "Last feeding 26m ago · right last side", "Last session 3 days ago · 155 ml", latest weight/height/head size).
- **Running state**: when the section has a running timer, the highlight is replaced by the live timer with its quick controls (defined by the feature spec) The shared card takes `running` and then shows its `[sectionRunning]` content in place of the highlight or the empty state; the split timer has a `compact` variant for it.
- **Recent entries**: the 3 most recent entries, always shown under the highlight.
- **Show more / Show less** (text button in the section colour): expands to every entry of the last 24 hours, or folds back to 3.
- **All activities**: opens the section's history page.

### Entry list item
Shared by the card's expanded list and the history page:
- Kind icon; headline: local time, then the optional label after " · "; supporting text: the section-specific summary on one line (ellipsis when too long). Every item is two lines, so all rows have the same height.
- A chevron; tapping the item opens the entry sheet in edit mode.

### History page
- The section's entries for the selected baby, newest first, as a plain list of entry list items, loaded page by page as the user scrolls. No totals, no charts.

### + button behaviour
- If the section has **several kinds of entry** (e.g. Feed: bottle / breastfeed / solids), + opens a **kind picker**: a bottom action sheet listing the kinds, each with its icon and label.
- If the section has **one kind** (e.g. Diaper), + opens the entry sheet directly.

### Entry sheet (add / edit form)
- A Material **bottom sheet** sliding up over the dimmed page, expanded to most of the screen height (a standard dialog on wide screens).
- Header in the section's colour, laid out like an M3 top app bar: close icon button on the left, the entry kind as title, **Save** text button on the right. Save saves the form only; × discards it (see Timers for entries with timers).
- Body as a list of **form rows** (M3 list items): label as headline, current value or action as trailing text ("Today 2:37pm", "Add") or a trailing switch. Tapping a row edits it with the standard Material control (timepicker/datepicker, text field, …).
- Optional **suggestion row** under a field (e.g. "Use last breast milk amount: 90 ml? [Yes]").
- A **Notes** row on every kind.
- In edit mode, who logged the entry and who edited it last, and when (shared `nala-entry-audit`: "Logged by Anna · Edited by Ben, 2:40 PM").
- In edit mode, a **Delete** action at the bottom (with confirmation).
- The same sheet is used to add and to edit an entry.

### Running timers mini-bar
- When any entry is live (breast feed now; sleep and pump later), a compact surface is **pinned at the bottom of every screen, just above the bottom navigation bar** (elevated M3 surface), containing one M3 list item per live entry: section icon, label, live duration, and a chevron.
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
- [x] Folded, the card lists the 3 most recent entries under the highlight.
- [x] "Show more" lists every entry of the last 24 hours (at least the 3 shown folded), loading more pages when needed; it is hidden when that adds nothing. "Show less" folds back to 3. The expanded state is remembered per device.
- [x] The history link reads "All activities" and opens the section's history page.
- [x] The + button and the Show more / Show less button use the section's colour tokens, not the app's primary colour.
- [x] With no entry yet, the highlight shows a section-specific empty state.
- [x] Time-since values ("26m ago", "3 days ago") update live without reloading.

### + and entry sheet
- [x] + opens the kind picker when the section has several kinds, the entry sheet directly otherwise.
- [x] The entry sheet header uses the section colour and has ×, the kind title and Save.
- [x] × closes the sheet without saving changes; if there are unsaved changes, it asks for confirmation first.
- [x] Save is disabled while required fields are missing or invalid, and shows field errors.
- [x] Tapping an entry list item opens the same sheet pre-filled, with a Delete action.

### Entry list item
- [x] Every entry list item has the same height: two lines, whatever the section or kind.
- [x] The headline shows the time, then the label after " · " when there is one.
- [x] The supporting text is one line, aligned with the headline, with an ellipsis when too long.
- [x] No duration bar is shown.

### Timers
- [x] Save on a live entry saves the form and leaves its timers running.
- [x] × on a sheet opened to add, after a Start, deletes the entry that Start created (after confirmation), online and offline.
- [x] × on an existing live entry discards the form edits and keeps the timer taps made in the sheet.
- [x] Only a live entry (a timer runs) shows the card's running state and a mini-bar row; once its timers are stopped it is an ordinary entry.
- [x] A live entry is listed in the card and history at once, with its live total.
- [ ] While the section has a live entry for the selected baby, + is replaced by the timer button, which opens that entry's sheet.

### Bottom navigation bar
- [ ] Every signed-in screen shows the floating bottom navigation bar with Dashboard, History, Trends and Settings, in that order; the current destination is marked active.
- [ ] Signed-out screens don't show it.
- [ ] The top app bar has no settings button; the settings page has no back link.
- [ ] History (`/history`) and Trends (`/trends`) show a "Coming soon" empty state.
- [ ] The mini-bar sits above the navigation bar, and the last element of a page can scroll above both.
- [ ] The sheet is usable one-handed on a phone: touch targets follow M3 minimums (48 × 48 dp). *(Tests check that only default-density Material controls are used; still to be checked by hand on a phone.)*

### Mini-bar
- [x] The mini-bar appears on every screen as soon as a timer runs, and disappears when none runs.
- [x] It shows each live entry with a live duration and opens the matching entry sheet on tap.
- [x] It reflects timers started or stopped from other devices within a few seconds.

### Theming
- [x] Each section has a colour token (and an "on colour" token for text/icons on it) defined in the global theme, with light and dark values. Components never hard-code these colours. Tokens: `--nala-section-<key>` / `--nala-on-section-<key>` (placeholders created in 01, `web/src/styles/_sections.scss`).
- [x] Each section also has `--nala-section-<key>-container` / `--nala-on-section-<key>-container` tokens (light and dark values), used by the card's + / timer button.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — Section preferences (server + settings).** `UserSectionPreference` entity + migration (user, key, position, visible; PK user + key; cascade on user delete). Core `SectionPreferences`: default order (feed, sleep, diaper, pump, growth, medication, all visible), stored rows merged with any new keys (appended, visible), validation (every known key exactly once, at least one visible). `GET /api/account/sections` → `[{ key, visible }]` in order; `PUT /api/account/sections` replaces the whole list → 200, 400 validation problem otherwise. Any enabled member, for themselves only. Web: `SectionPreferencesService`, a "Home sections" settings section (CDK drag list with drag handles, a visibility switch per row, the last visible one can't be turned off), limited to registered sections. Covers: default order, reorder/hide in settings, saved per user on the server, hiding keeps the data, theming (tokens from 01).
- [x] **Slice 2 — Home column, section card, entry list item.** Section registry. Home renders one shared `nala-section-card` per visible registered section, in the user's order, in a single column under the top app bar. Card: `mat-card`, header band on the section tokens, `mat-mini-fab` +, highlight slot with an empty-state slot, Show more / Show less (up to 10 entries, expanded state per device in `localStorage`), View all history. Shared `nala-entry-list-item` (kind icon, local time, summary, optional duration bar + duration, chevron). Shared ticking `NowService`, time-since and duration pipes (EN/FR). Covers: home in the user's order, the card criteria (frame, empty state, show more/less, live time-since). The frame criterion is ticked with slice 4, when View all history leads to the history page.
- [x] **Slice 3 — + button, kind picker, entry sheet frame.** + opens the shared `nala-kind-picker` (`MatBottomSheet`) with several kinds, the entry sheet directly with one. Entry sheet through `SheetService`: `nala-sheet-header` on the section colour, shared form row, suggestion row, notes row and delete action (with confirmation); × asks before discarding changes, Save disabled while invalid with field errors, entry list item opens the sheet pre-filled with Delete; 48 × 48 dp targets. Tested with a fake section. Covers: every "+ and entry sheet" criterion.
- [x] **Slice 4 — History page.** `/history/:section` (signed in, a baby required, unknown or unregistered key → home), back button, the section's entries for the selected baby newest first as entry list items, loaded page by page on scroll through the section's page loader. No totals or charts. Opened from View all history. Covers: the history part of the section card criterion.
- [x] **Slice 5 — Running timers mini-bar (shell).** `RunningTimersService` merging the registered timer sources; shared `nala-running-timers-bar` pinned at the bottom of every screen: one list item per running timer (section icon, label, live duration, the baby's name with several babies, chevron), opens the timer's sheet on tap, hidden when none runs. Tested with a fake source. Covers: mini-bar criteria 1 and 2 (criterion 3, other devices, comes with 05's live sync).

Changes after the first review of the Feed section (built in this order, with 05's slice 8 between slices 8 and 9):

- [x] **Slice 6 — Same-height entry list items.** `nala-entry-list-item`: always a two-line item, headline "time · label", one-line supporting text aligned with the headline (ellipsis), `summaryLines`, `durationSeconds`, `durationScaleSeconds` and the bar removed. Feed entries: solids "4:23 PM · Snack · Liked" / food on one line; breastfeed "Total 8m 30s · L 5m · R 3m 30s". Feed card "last side" capitalised ("Right" / "Left"). Covers: the Entry list item criteria, 05's Entry list items criteria and the capitalised last side.
- [x] **Slice 7 — Section colours on the card buttons.** `--nala-section-<key>-container` / `--nala-on-section-<key>-container` tokens; the + small FAB and the Show more / Show less text button take the section colours through the theme. Covers: the container-token theming criterion and the card buttons colour criterion.
- [x] **Slice 8 — 3 recent entries, last 24 hours, All activities.** Shared helper loading a section's entries of the last 24 h (at least 3) through its page loader; section card shows 3 folded, the 24 h list expanded, Show more hidden when it adds nothing; "All activities" link; `RECENT_ENTRIES` removed. Feed card uses the helper (`loadRecentEntries` in `core/sections/`; a failed page leaves the card as a failed load does). Covers: the three new Section card criteria about recent entries and All activities.
- [ ] **Slice 9 — Live timer button.** The section card takes the section's live entry for the selected baby from `RunningTimersService` and replaces + with the timer button opening it. Tested with a fake timer source. Covers: the last Timers criterion (the other Timers criteria are covered by 05's slice 8, the first section with timers).
- [ ] **Slice 10 — Bottom navigation bar.** Shared `nala-bottom-nav` (floating, rounded, translucent with backdrop blur, safe area) on every signed-in screen; `/history` and `/trends` placeholder pages (empty state "Coming soon"); settings button removed from the top app bar and back link from the settings page; the mini-bar stacked above the bar; bottom padding on pages. Covers: every Bottom navigation bar criterion.

## Material 3 mapping

Use Angular Material's M3 components as-is. Customize only through the global theme (colour tokens, typography, density); do not override component shapes, sizes or internal styles in component CSS. When no Material component exists (e.g. the section card's header band, the duration bar), build it from Material surfaces and theme tokens, following M3 guidance.

| Pattern element | Material 3 / Angular Material |
|---|---|
| Top app bar | Top app bar (`mat-toolbar`) |
| Baby switcher | Menu (`mat-menu`) opened from the baby's name in the top app bar |
| Section card | Card (`mat-card`, elevated or filled) |
| + button | Small FAB (`mat-mini-fab`) |
| Show more / All activities | Text button / list item with trailing icon |
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
| Live timer button | Small FAB (`mat-mini-fab`) with the `timer` icon, in place of + |
| Bottom navigation bar | No Angular Material component: built from M3 navigation bar guidance (icon + label destinations, active indicator pill) on a translucent surface, with router links |

## Data

- **User section preference:** user, section key, position, visible.
- Section keys: `feed`, `sleep`, `diaper`, `pump`, `growth`, `medication` (extended as features are added).

## UI notes — shared components

Section card (with the live timer button), entry list item (two lines: time · optional label, one-line summary), bottom navigation bar, kind picker sheet, entry sheet (header, form row, suggestion row, notes row, chip choice row `nala-chip-choice-row` for optional single choices as filter chips, delete action, entry audit line), time picker row (`nala-time-row`: "Today 2:37 PM", datepicker + timepicker editing the date and the time separately), duration field (`nala-duration-field`, minutes + seconds, and `nala-duration-dialog` around it), banner (`nala-banner`: icon, title, text, optional action; a section card shows one above its highlight through the `[sectionBanner]` slot), running timers mini-bar, empty state.

## What each feature spec must define

- Kinds of entry (and their icons) and whether + opens a kind picker.
- Card highlight (normal and running state) and empty state.
- Entry list item summary per kind.
- Entry sheet rows per kind, defaults and suggestion rows.

## Out of scope

- Photos on entries (decided: never).
- Totals, statistics and charts in cards or history (the Trends destination is a placeholder; its content comes with feature 12's spec).
- Home widgets other than section cards.
