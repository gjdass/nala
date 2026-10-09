# 11 — History

Status: specified

Builds on [04 — App layout](04-app-layout.md): the app shell, the section registry, the entry list items, the entry sheets, `nala-history-list` paging and the reload signal apply. Each section's list item and sheet come from its own spec (05–10). This spec only adds what is specific to the History destination.

## Goal

On the History tab, show the selected baby's entries from several sections in one list, newest first, filtered by a time window and by section, and let the parent fix any of them with a tap.

## Decisions

### Page
- `/history` replaces the "Coming soon" placeholder (Trends keeps it). It has **no page title**: the shared top app bar (baby switcher and Nala brand) stays, as on home, then the filter bar, then the list. Without a baby, the page shows 03's empty state, as home does.
- **View and edit only:** no + button, no kind picker on this page.
- The bottom navigation bar marks **History** active on `/history`, whatever its query.

### Filter bar
- At the top of the page, under the top app bar, **sticky** (it stays under the top edge guard while the list scrolls).
- **Time window:** an M3 segmented button (`mat-button-toggle-group`) with **24 h** (default), **7 days** and **30 days**, each a rolling window: the entries whose time is at or after now − 24 h / 7 × 24 h / 30 × 24 h. The window is taken when the list loads and doesn't move while the page stays open, as the card's Show more; a list loaded again (filter change, baby switch, reload signal) takes a new one.
- **Sections:** an M3 filter chip with a dropdown (`mat-chip` opening a `mat-menu`), reading "Sections" with the number selected ("Sections · 3"). Its menu lists **every registered section**, each with its icon, title and a checkbox:
  - first the sections **visible on home**, in the user's home order (04's section preferences);
  - then, after a divider, the sections **hidden from home**, in the same order.
  - Default selection: **Feed, Sleep and Diaper**. Selecting or unselecting one applies at once and keeps the menu open. The last selected section can't be unselected (its checkbox is disabled), the same rule as "at least one visible section" in settings.
- Changing a filter loads the list again from the first page.
- **Remembered per device:** the filters chosen from the bar are saved in `localStorage` (`nala.historyFilters`: `{ window, sections }`) and restored when History is opened from the bottom bar. A stored key no longer registered is dropped; a stored selection left empty, or unreadable, falls back to the default. A section registered later starts unselected.

### Opened from a section card
- A card's **All activities** opens `/history?section=<key>`: only that section selected, the **7 days** window. These filters come from the link, never from `localStorage`, and **nothing is saved** while History shows them: changing a filter there changes the list only. Opening History from the bottom bar afterwards shows the remembered filters again.
- An unknown `section` in the query is ignored (the remembered filters apply).
- The per-section history page (`/history/:section`) and each section's history component (`loadHistory`) are retired; `/history/:section` redirects to `/history?section=<key>` for a registered section (bookmarks), home otherwise.

### List
- Every entry of the selected sections whose time falls in the window, **newest first, interleaved across sections**: ordered by each section's time (Feed, Sleep and Pump by start time; Diaper and Health by time), ties by section in the home order, then the section's own order. Growth is date-only, so a growth entry counts as **local midnight of its date**, for the window as for the order: today's measurement appears below today's timed entries.
- Each entry is **its section's own list item** (`nala-feed-entry`, `nala-sleep-entry`…), inside its section's colour scheme (`.nala-scheme-<key>`), so it looks exactly as on its card. A live entry is listed with its live total, as on the cards.
- **Tap → edit:** opens the entry's sheet in edit mode, as on home (`EntrySheetService.edit(section, kind, entry)`). A saved entry is replaced where it is, a deleted one removed, without a reload (04's history rule).
- **States:** `nala-history-list` as it is: progress spinner while loading, the next page loading when the end scrolls into view, an empty state ("Nothing logged in this period"), and an error with Try again keeping what is already shown. A new baby, a filter change or the reload signal (04) starts again from the first page. Reading needs the network (overview).
- **Growth's Birth item** (spec 10) is not listed: it lives on the baby's profile (03). *(See Open questions.)*

### Architecture
- **No API change.** The overview asks a combined timeline to aggregate across types explicitly: the web does it with each section's existing list endpoint.
- **History sources:** each `SectionDefinition` gets a lazily loaded history source (`loadSource: () => import(…)`, replacing `loadHistory`), providing: the section's page loader for a baby, the entry's time (for the window and the order), the entry's kind (to open its sheet), and the entry list item component. A new section joins History by registering its source.
- **Merged loader** (`core/history/`): for each selected section it pages through that section's list (limit 50) until an entry is older than the window or the last page, merges the sections newest first, and hands out pages of 20 items `{ id, section, entry }` in final order. It has the `HistoryPageLoader` signature, so `nala-history-list` (paging, `apply()`, retry) is reused unchanged. A section's failed page fails the whole load (Try again retries it); nothing is listed out of order.

## User stories

- As a parent, I want to see everything logged for my baby in the last 24 hours in one list, so I can tell the doctor or my partner what happened.
- As a parent, I want to widen it to the last week or month and choose which sections to see.
- As a parent, I want my filters kept the next time I open History on this phone.
- As a parent, I want "All activities" on a card to show that section's last week.
- As a parent, I want to fix or delete a wrong entry right from History.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Page
- [ ] `/history` shows the top app bar (baby switcher and brand), the filter bar and the list; no page title, no + button.
- [ ] Without a baby, it shows 03's empty state.
- [ ] History is the active destination on `/history`, with or without a query.

### Filter bar
- [ ] By default (nothing remembered) the window is 24 h and Feed, Sleep and Diaper are selected.
- [ ] The time window offers 24 h, 7 days and 30 days (rolling), as a segmented button.
- [ ] The sections menu lists the sections visible on home in home order, a divider, then the hidden ones in home order; the chip shows how many are selected.
- [ ] Selecting or unselecting a section updates the list; the last selected one can't be unselected.
- [ ] Changing a filter loads the list again from the first page.
- [ ] Filters chosen from the bar are remembered on the device and restored when History is opened from the bottom bar; an unknown stored key is dropped, an empty or unreadable selection falls back to the default.
- [ ] The filter bar stays at the top while the list scrolls.

### Opened from a card
- [ ] A card's All activities opens History with only its section selected and the 7 days window.
- [ ] Filters opened from a card, or changed afterwards on that view, are never saved; History opened from the bottom bar then shows the remembered ones.
- [ ] An unknown section in the link is ignored; `/history/<key>` redirects to History opened for that section, anything else goes home.

### List
- [ ] It lists the selected sections' entries within the window, newest first, interleaved across sections; an entry outside the window, or of an unselected section, is never listed.
- [ ] A growth entry counts as local midnight of its date, for the window and the order.
- [ ] Each entry shows its section's list item in its section's colours; a live entry shows its live total.
- [ ] Tapping an entry opens its sheet in edit mode; a save replaces it in place, a delete removes it, without a reload.
- [ ] The list pages as it scrolls, never out of order; it shows a spinner while loading, an empty state for an empty period, and an error with Try again that keeps the entries shown.
- [ ] Switching baby or the reload signal (04) loads the list again from the first page.

### Merged loader
- [ ] It reads each selected section's pages only until one entry is older than the window (or the last page), and returns pages of 20 in final order.
- [ ] A failed section page makes the load fail; Try again retries it and the list goes on in order.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [ ] **Slice 1 — Merged loader and history sources.** `core/history/` merged loader (window cut-off, order across sections, Growth by date, pages of 20, errors), `loadSource` registered by all six sections. Covers: Merged loader.
- [ ] **Slice 2 — History page with the default filters.** `/history` replaces the placeholder: no title, list of the last 24 h of Feed, Sleep and Diaper, each section's list item in its scheme, tap → sheet with in-place update, empty and error states, baby switch and reload signal; spec 04 updated first (only Trends stays a placeholder). Covers: Page, List.
- [ ] **Slice 3 — Filter bar.** Time segmented button and sections dropdown chip (home order, hidden ones after a divider, last one locked), restart on change, remembered per device, sticky. Covers: Filter bar.
- [ ] **Slice 4 — All activities opens History.** `/history?section=<key>` with the 7 days window and nothing saved, `/history/:section` redirect, section history components and `loadHistory` retired; specs 04 and 10 updated first (history page, All activities, Birth item). Covers: Opened from a card.

## Data

Nothing new on the server. On the device: `nala.historyFilters` (`localStorage`): `{ window: "24h" | "7d" | "30d", sections: SectionKey[] }`.

## UI notes

- Reused: `nala-top-app-bar`, `nala-history-list`, each section's list item component, `EntrySheetService`, 03's no-baby empty state.
- New: `nala-history-filter-bar` (segmented button + sections dropdown chip) in `features/history/`.
- Labels (EN / FR): "24 h" / "24 h", "7 days" / "7 jours", "30 days" / "30 jours", "Sections" / "Sections", "Sections · 3" / "Sections · 3", "Nothing logged in this period" / "Rien de noté sur cette période". Section titles reuse `sections.<key>`.

## Out of scope

- Totals, statistics and charts (feature 12, Trends).
- Day headers ("Today", "Yesterday") between entries: each item's time already says it.
- Adding entries from History.
- Custom date ranges, search, filtering by kind or by who logged an entry.
- Reading history offline.

## Open questions

- **Birth item:** with `/history/:section` retired, Growth's Birth item (spec 10) has no list to end. Proposed: drop it from History (the birth measurements stay on the baby's profile and as the card highlight's fallback). Alternative: list it as a Growth item at the birth date, so it shows only while the birth date is within the window.
