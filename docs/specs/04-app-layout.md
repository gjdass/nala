# 04 — App layout & section pattern

Status: done

## Goal

Give every activity section (Feed, Sleep, Diaper, Pump, Growth, Health) the same structure, so the app is predictable and each new section is mostly built from shared components. Feature specs only describe what is specific to their section, using the vocabulary defined here.

This spec has four parts:
- **App shell:** safe areas, top app bar, bottom navigation bar, home and its per-user section order.
- **Section pattern:** section card, kind picker, entry sheet, entry list item, history page, formats, colours.
- **Entries:** the API conventions, offline queue and rules every section's entries share.
- **Timers:** the rules, API, mini-bar and live sync shared by every section with timers (Feed's breastfeed, Sleep, Pump).

**Structure vs. styling:** the reference screenshots define the *layout and flow*. Every element itself is a standard **Material 3** component from Angular Material, used as designed, with only theme-level customization. See [Material 3 mapping](#material-3-mapping).

## App shell

### Safe areas
- The app draws edge to edge (`viewport-fit=cover`) and keeps clear of the iPhone's status bar, notch / Dynamic Island and home indicator itself: every screen starts below the top safe area plus 8 px (so iOS's blur under the status bar never touches the content), the bottom navigation bar and the bottom sheets end above the bottom safe area. Off iOS (no safe area) nothing changes. The top offset is the global `--nala-safe-top` (`_layout.scss`).
- iOS 26 lays its own blur (the "scroll edge effect") over the top of a home screen web app unless a fixed box with a solid background covers the top edge, even when it reports no top safe area (`default` status bar style). So the app shell holds an edge guard: a fixed strip across the top edge, as tall as the top offset, in the page background colour (`--mat-sys-surface`); iOS then tints the edge with that colour instead of blurring. On iOS the top offset is at least 12 px so the guard is tall enough for iOS to take it (more than 10 px); elsewhere the guard is 0 px tall and nothing changes. Content scrolls under the guard, never over it.
- The page never rubber-bands (`overscroll-behavior-y: none` on the document): pulling past the top or bottom doesn't drag the page, so the bottom navigation bar never moves.

### Top app bar
- Selected baby (name + age) with the baby switcher (03). Shared `nala-top-app-bar`. No settings button: Settings is a destination of the bottom navigation bar.
- On the right, vertically centred with the baby's name + age block, the Nala brand: "Nala" in `headline-small`, `on-surface-variant`, then the lion's head (`icons/brand-mark.png`, 72 px, generated from the artwork like the favicon) at 40 px, the height of the name + age block (`title-medium` + `body-small` lines), so the brand fills the same row height. Decorative (not a button, not translated), shown with or without a baby. A long baby name ends with an ellipsis before the brand is squeezed. The section history page keeps its own bar (back + title), without the brand.

### Bottom navigation bar
- Shared `nala-bottom-nav`, on every signed-in screen (auth state with a user), never on the signed-out ones (setup, login, invitation, password reset).
- Four destinations, in this order: **Dashboard** (`/`, home), **History** (`/history`), **Trends** (`/trends`), **Settings** (`/settings`), each an icon only (the destination name is its accessible name and tooltip), the current one marked with the M3 active indicator pill. A section's history page (`/history/:section`) is reached from a home card, so **Dashboard** stays the active destination there; History is active on `/history` only. The settings page has no back link (it is a destination).
- History and Trends are placeholders: the shared top app bar, the destination as page title and a "Coming soon" empty state; their content is features 11 and 12.
- Floating, fixed at the bottom of the screen above the safe area: not full width (70 % of the screen width minus the 16 px side margins, at most 294 px wide, centred), compact (about 60 px tall: 48 dp destinations, no visible labels), fully rounded ends, a translucent surface with the page blurred behind it (`backdrop-filter`, theme token `--nala-nav-bar-surface` in `_navigation.scss`), like the iOS "liquid glass" bars. While it holds timer rows (see [Running timers mini-bar](#running-timers-mini-bar)) it takes the full width between the side margins, at most 360 px, and the M3 large corner.
- The bar sits in a dock pinned at the bottom of the app shell, after the page, so the page's last element always scrolls above it (no per-page padding).

### Home and section preferences
- Home is a **single column of section cards**, one above the other, scrollable, once there is a baby (without one, 03's empty state).
- The order and visibility of the cards are chosen **per user** and saved on the server (same on all their devices). Default order: Feed, Sleep, Diaper, Pump, Growth, Health; all visible.
- **Endpoints:** `GET /api/account/sections` → 200 `[{ key, visible }]` in the user's order: the default order until they save one; keys added later are appended visible, stored keys no longer known are dropped. `PUT /api/account/sections` with the whole list → 200 with it; 400 validation problem `sections`: `invalid` (not every known key exactly once, or an item without key/visible) / `noneVisible`. Any enabled member, for their own preferences only (session fallback policy).
- **Home sections in settings:** a "Home sections" section after Members & invitations. One list item per registered section: drag handle, title, visibility switch; the switch of the last visible one is disabled. Each drop or switch saves at once (like the language and theme), shown right away and put back with a snackbar if saving fails. The web always sends every known key: a key with no registered section keeps its slot and visibility.
- Hiding a section only hides its card; its data is kept.

## Section pattern

### Section registry
- The web keeps a section registry. Each section registers its key, icon, its card component, its history component and its kinds of entry (key, icon, label translation key, sheet component). Home and the settings list only show registered sections.
- The card is self-contained: it loads its entries for the selected baby and wraps the shared section card. The history component is self-contained too: it wraps the shared `nala-history-list` with a page loader for the selected baby and the `nalaSectionEntry` template, and opens entries for editing.
- The registry is part of the initial bundle, so it holds **loaders** for these components (`loadCard`, `loadHistory`, each kind's `loadSheet`: `() => import(…)`), never the components themselves: home and the history page render them through the `nalaLoadComponent` pipe, and `EntrySheetService` loads a kind's sheet before opening it.

### Section card
Every section card has the same frame (shared `nala-section-card`), filled with section-specific content:

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

- **Header band** in the section's colour, with the section title in an M3 title typescale.
- **+ button:** an M3 small FAB (standard M3 shape, not a circle) at the right of the header band. While the section has a live entry for the selected baby it becomes the **timer button** (see Timers).
- **Highlight:** the summary of the last record(s), defined by each section spec, with a section-specific **empty state** when there is nothing to highlight. By default the card decides from its entries; a section can set the card's `empty` input itself (Growth). A section may show a shared `nala-banner` above the highlight through the `[sectionBanner]` slot ("Still feeding?").
- **Recent entries:** folded, the card lists the **3 most recent entries** under the highlight. **Show more** lists every entry that started in the **last 24 hours** (never fewer than the 3 already shown); it is hidden when the 24 hours hold no more than those 3. **Show less** folds back to 3. The card loads its entries through the section's page loader with the shared `loadRecentEntries` helper (`core/sections/`): page after page until an entry is older than 24 h or the last page (the window is taken when the card loads, it doesn't move while the page stays open; a failed page leaves the card as a failed load does).
- **Show more state:** remembered per device and per section in `localStorage` (`nala.sectionExpanded.<key>`).
- **All activities** opens the section's history page.
- **No timer on the card:** a live entry changes nothing in the card body (see Timers).

### Section colours
- Each section has a colour token and an "on colour" token (`--nala-section-<key>` / `--nala-on-section-<key>`), plus container tokens (`--nala-section-<key>-container` / `--nala-on-section-<key>-container`: palette 90 / on 10 in light mode, 30 / on 90 in dark mode), defined in `web/src/styles/_sections.scss` with light and dark values. Components never hard-code these colours.
- **Card buttons:** the + / timer button small FAB uses the container tokens; the Show more / Show less text button uses `--nala-section-<key>`. Both are applied through the global theme, not component CSS: `mat.fab-overrides` on `.nala-section-fab` and `mat.button-overrides` on `.nala-section-text-button`, reading `--nala-section-container` / `--nala-on-section-container` / `--nala-section-accent`, which the section card sets to its section's tokens. Scoped to these two buttons, so buttons projected by features keep their own colours.
- **Section colour scheme:** everything shown inside a section uses that section's own full M3 colour scheme (primary, secondary, tertiary, surfaces, outlines…), generated from the section's palette, never the app's: the section card, the section's history page, its kind picker, its entry sheets and every overlay they open (confirmation and duration dialogs, date pickers). One global class per section, `.nala-scheme-<key>` (`_sections.scss`, `mat.theme` colours only, `theme-type: color-scheme`), named by `sectionScheme(key)`; it is set on the card, on the history page and as the `panelClass` of the section's overlays. `nala-entry-sheet` provides `SECTION_SCHEME` (the class) to its content, so shared rows that open overlays (the time row's pickers) and kind sheets use it. Outside sections (home without a baby, settings, sign-in, the baby sheet, the bottom navigation and its mini-bar) the app scheme stays.

### + button and kind picker
- While the section has no live entry, the shared section card handles + itself (`EntrySheetService.add`) and emits `changed` once a sheet saved, so the section's card reloads.
- With **several kinds of entry** (e.g. Feed: bottle / breastfeed / solids), + opens the **kind picker** (shared `nala-kind-picker`): a bottom sheet on every screen size, listing the kinds, each with its icon and label.
- With **one kind** (e.g. Diaper), + opens the entry sheet directly.

### Entry sheet (add / edit form)
- A Material **bottom sheet** sliding up over the dimmed page, expanded to most of the screen height (a standard dialog on wide screens), through the shared `SheetService`.
- Each kind's sheet wraps the shared `nala-entry-sheet` frame and is opened with `{ section, kind, entry }` (entry null when adding); it closes with `{ saved }` or `{ deleted: id }`. A section card opens an entry for editing with `EntrySheetService.edit(section, kind, entry)`. The same sheet is used to add and to edit an entry.
- Header (`nala-sheet-header`) in the section's colour, laid out like an M3 top app bar: close icon button on the left, the entry kind as title, **Save** text button on the right. Save is disabled while required fields are missing or invalid, and the fields show their errors. × closes without saving; with unsaved changes it asks for confirmation first. (Entries with timers: see Timers.)
- Body as a list of **form rows** (shared `nala-form-row`, M3 list items): label as headline, current value or action as trailing text ("Today 2:37 PM", "Add") or a trailing switch. Every trailing text uses the same `label-large` type style, whether the row is tappable or read-only (e.g. "Sleeping…", a duration, a total); only tappable values take the primary colour. Tapping a row edits it with the standard Material control.
- Optional **suggestion row** under a field (shared `nala-suggestion-row`: "Use last breast milk amount: 90 ml? [Yes]").
- A **Notes** row on every kind (shared `nala-notes-row`): "Notes … Add" until tapped, then an inline multi-line text field (already open when the entry has notes, also when they arrive after the sheet opened). At most 1000 characters.
- In edit mode, who logged the entry and who edited it last, and when (shared `nala-entry-audit`: "Logged by Anna · Edited by Ben, 2:40 PM"; the edited part once the entry was changed after it was logged). List items don't show it.
- In edit mode, a **Delete** action at the bottom, with confirmation.

### Time row
- Shared `nala-time-row`: "Today 2:37 PM". The date is edited with the Material datepicker, the time with an hour field and a minute field side by side, each typed with the device's numeric keypad, exact to the minute; a focused field selects its content. In English the hour is 1–12 with an AM / PM segmented button; in French it is 0–23 (from `Intl`). The value changes as soon as both fields hold a valid number; an invalid number shows the field error and leaves the value as it was.
- Empty, it offers "Add"; tapping it sets the time to now and opens its pickers. It shows `beforeStart` when used as an end time.
- `dateOnly` mode (Growth): datepicker only, "Today" / "Sep 28", a `Date` at local midnight in the form.

### Formats
- **Time since** (card highlights and banners): hours and minutes only, never seconds: `just now` (under 1 min), `26m ago` (under 1 h), `2h 15m ago` / `2h ago` (under 24 h), `>24h ago` (24 h or more). French: `à l'instant`, `il y a 26 min`, `il y a 2 h 15 min`, `il y a plus de 24 h`. Refreshed every second from the shared `NowService` clock.
- **Highlight durations** (a duration shown in a card highlight, e.g. Sleep's "Awake for" and "last sleep"): hours and minutes only: `<1m` (under 1 min), `26m`, `2h 15m` / `2h`, `>24h` (24 h or more). French: `<1 min`, `26 min`, `2 h 15 min`, `>24 h`. Shared pipe `nalaHighlightDuration`; every section's highlight uses it (or Time since), never the full duration format.
- **Durations** (everywhere except card highlights: timers, entry summaries, sheets, mini-bar): `45s`, `8m 30s` / `8m`, `1h 5m` / `2h` (zero parts left out, seconds left out from 1 h). French: `45 s`, `8 min 30 s`, `1 h 5 min`.
- **Entry time** (`nalaEntryTime`): the local time for today's entries (`2:10 PM`), `Yesterday 2:10 PM`, then date and time (`Sep 20, 2:10 PM`, with the year when it is not the current year). **Entry date** (`nalaEntryDate`, date-only entries): its date part ("Today", "Yesterday", "Sep 28").

### Entry list item
- Shared `nala-entry-list-item`, used by the card and the history page. Every item is the same two-line M3 list item, whatever the section or kind, so rows have the same height: kind icon; headline: the local time (or the date with `dateOnly`), then the optional label after " · " ("4:23 PM · Snack · Liked"); supporting text: the section-specific summary on one line, aligned with the headline, cut with an ellipsis when too long; a chevron. Tapping it opens the entry sheet in edit mode.
- No duration bar: a duration is written in the summary by the section ("Total 8m 30s · L 5m · R 3m 30s").

### History page
- `/history/:section`, for a registered section only (anything else → home); without a baby it goes home. M3 top app bar: back icon button to home, title "Feed history" with the selected baby's name as supporting text, no switcher. Below, the section's registered history component.
- The section's entries for the selected baby, newest first, as a plain list of entry list items. No totals, no charts.
- **Paging:** a page loader is `(cursor | null) → { entries, next }`, newest first; `null` asks for the first page and `next: null` marks the last one (the cursor format is each section's API). The next page loads when the end of the list scrolls into view (and again right away while it stays in view). While loading: a progress spinner. Without entries: an empty state ("Nothing logged yet"). A failed page shows an error with Try again, keeping the pages already loaded. A new loader (another baby) starts again from the first page. An entry edited from the history is replaced where it is, a deleted one removed; no reload.
- A section may add an end template (`nalaHistoryEnd`), rendered after the last page (not while loading nor after an error); with it, the list shows no empty state (Growth's Birth item, spec 10).

## Entries

Rules every section's entries follow. Section specs only list their own fields, codes and extra endpoints.

### Entry model
- Every entry has a client-generated UUID, its baby, its time(s) in UTC (or a calendar date for date-only entries), notes, who logged it, created at, updated at and who updated it. The server sets created at / updated at (arrival times).
- Each section has its own entity, table and endpoints (overview, activity model). Entries are deleted with their baby (`ON DELETE CASCADE`, 03). Deleting an account never changes the entries it logged: they keep showing that person's display name.
- Any member can edit or delete any entry; each change records who made it and when.

### Entry API conventions
For a section with resource `/api/<entries>` (e.g. `/api/diapers`):
- `POST /api/<entries>` with `{ id, babyId, …fields }` → 201 with the entry. Sending an existing id again → 200 with the stored entry unchanged (idempotent re-send).
- `PUT /api/<entries>/{id}` with every editable field → 200 with the entry (the baby, and the kind for sections with kinds, never change). `DELETE /api/<entries>/{id}` → 204. `GET /api/<entries>/{id}` → 200. An unknown entry → 404 `{ code: "<entry>NotFound" }`.
- `GET /api/babies/{babyId}/<entries>?cursor=&limit=` → `{ entries, next }`, newest first (by the section's time, then id), 20 per page by default, 1–50; the cursor is opaque, a malformed one → 400 `cursor: invalid`. An unknown baby → 404 `{ code: "babyNotFound" }`.
- Each entry carries `loggedBy` and `updatedBy` (`{ id, displayName }`). Fields of another kind are ignored and returned null.
- Validation problems (400) are keyed by field, with codes. Every section has `id` / `babyId` `required`, its time `required`, `notes` `tooLong` (over 1000).
- Any signed-in, enabled member (session fallback policy).
- Shared Core code in `Nala.Core/Entries` (`UserName`, `EntryCursor`, `EntryFields`, `EntryPaging`), `Nala.Api/Entries` (`UserNameResponse`); web `core/entries` (`UserName`, `EntryResult` / `EntryDeleteResult`, `toEntryResult` / `toDeleteResult`).

### Times
- **Times in the future are allowed.** No entry time, date, duration or timer tap is refused for being in the future, in the app or the API: the user logs what they want. Only the baby's birth date (03) can't be in the future. "End after start" and "not before birth" stay.

### Offline queue
- A shared device queue (`core/offline/`, `localStorage`) keeps every add / edit / delete (and timer tap) made while the server can't be reached (no network, or 502/503/504), with the signed-in user and the time of the action. Once one waits, the user's next changes queue behind it so they arrive in order.
- A snackbar says "Saved on this device. It will be sent when you're back online."; the card and history stay as they were until the queue is sent, then reload (reading history needs the network). For timer taps, only the first tap queued while nothing waits shows it (Save always does).
- The queue is sent oldest first, one at a time, as its own user only: at app start / login, back online, when the app is shown, and every 30 s while some wait; one tab at a time (Web Locks). A network failure, a server error or 401 stops and keeps the rest; a request refused for good (other 4xx) is dropped with a snackbar "A change made offline couldn't be applied."; a queued delete answered 404 counts as done.
- Logout and session expiry keep the queue on the device; it is sent once the same user signs in again. Another user's queued changes are never sent.
- Re-sending is idempotent through the client UUIDs (entries, and timer actions' own ids).
- Requests queued by an older app version are upgraded before sending (`core/offline/queue-upgrades.ts`, e.g. Feed's finish taps, spec 05).

## Timers

Rules for every section with timers: Feed's breastfeed (two per-side timers, `nala-split-timer`), Sleep and Pump (one timer, `nala-timer`). Section specs only add what differs.

### Live or not
- An entry with timers is either **live** (one of its timers runs) or **not live**. There is no paused, in-progress or finished state: stopping the timers makes it an ordinary entry, and Start on it (from its sheet) makes it live again. (Some API names say "in progress"; they mean live.)
- The entry exists from its first Start, and is listed at once (card and history) with its live total.
- The end time is the end of the last timed segment, empty while live.
- Timers live on the server: a live entry is visible on every member's device, any member can stop it, and it survives closing the app. Durations are computed from the stored timestamps, not from a client-side counter.
- Only live entries show the timer button, a mini-bar row, and are synced live between devices.
- **No timer on the card:** a section card never shows a live timer or timer controls. While an entry is live the card keeps its normal highlight (or empty state), the live entry is listed with its live total, and the timer button opens it; the timers are driven from the entry sheet only.
- **One live entry per baby and section:** starting a timer while another entry of that baby and section is live is refused (409) and the sheet opens the live one; opening the kind's sheet to add while one is live opens that one. Exception: a Start sent from a device's offline queue (`queued: true`) is kept anyway, so an entry logged offline is never dropped (two live entries; the card, the timer button and + show the oldest; the mini-bar lists both, each opening its own sheet). Enforced by the service, not a unique index.
- Each section defines a "Still …?" warning for an entry live too long: the shared banner on the card (Review opens the sheet) and at the top of the sheet.

### Entry sheet with timers
- **Save saves the form and never starts or stops a timer:** a live entry stays live after Save.
- **× discards what Save would have saved.** On a sheet opened to add, it deletes the entry its Start created (after the unsaved-changes confirmation: a Start counts as a change; queued offline like any delete). On an existing entry it discards the form edits only; timer taps made in the sheet stay (they are live actions, already seen by other devices), and the sheet closes with the entry as the taps left it.
- Delete is offered for a live or stopped entry.
- **Typing a timer's duration:** the duration shown by a timer (`nala-timer`, each side of `nala-split-timer`) is itself the button that edits it (primary colour, "Edit duration" accessible name): tapping it opens the duration dialog (`nala-duration-dialog` around `nala-duration-field`: minutes and seconds, typed with the device's numeric keypad, each field selecting its content when focused, 4 h at most), filled with the duration shown. There is no separate pencil. The start time never changes: the end time becomes start + typed duration (a split timer: start + both sides). Typing a duration freezes the timer and disables Start / Stop until Save or ×, also on a live entry; Save then stores the typed end, so the entry is no longer live (an explicit correction, like typing an end time). × discards the typed duration; a running timer keeps running.
- **Changed or deleted elsewhere:** an open sheet follows timer taps and edits made on another device (a field edited in the sheet keeps its value). When its entry leaves the live list, the sheet fetches it (`GET /api/<entries>/{id}`): stopped, it shows it; deleted (404), it closes with a snackbar "This <entry> was deleted on another device." (unless a duration is being typed).
- Sleep and Pump share the sheet logic in `shared/ui/entry-sheet/live-entry-sheet.ts` (`LiveEntrySheet`: start / end time and notes controls, timer, Save, Delete, ×, opening the live entry, following other devices; a section adds its own fields through its hooks).

### Single-timer entries (Sleep, Pump)
- An entry is a start time and an end time (no segments). Start on a stopped entry makes it live again by clearing its end time, so its duration runs from the original start time again.
- **Sheet rows:** Start time (set by Start, editable), End time (editable when not live; a section-specific "Sleeping…" / "Pumping…" while live, not editable), Duration (end − start, read-only), the section's own rows, Notes. A single timer (`nala-timer`): the duration and a Start / Stop button (M3 tonal, filled while running).
- **Adding by hand:** the sheet opens with the start time at now and no end time ("Add"). Typing an End time on an entry that isn't live, or typing the timer's duration, disables Start / Stop until Save or ×. Save is disabled when the end time is missing (not live) or not after the start time. A past entry can be logged entirely by hand.
- **Endpoints** (on top of the entry API conventions): `POST /api/<entries>` creates a stopped entry (`endTime` required). `PUT /api/<entries>/{id}` on a stopped entry replaces every field; on a live entry `endTime` must be null and the entry stays live. `POST /api/<entries>/{id}/start` `{ babyId, at, queued? }`: an unknown id creates a live entry (start time = `at`) → 201; a stopped entry becomes live again (end time cleared) → 200; a live one is unchanged → 200; another live entry for the baby → 409 `{ code: "<entry>InProgress" }` unless `queued: true`. `POST /api/<entries>/{id}/stop` `{ at }` sets the end time to `at` (already stopped → 200 unchanged). Every timer action carries the client's time `at`, so a queued tap can be replayed.
- **Validation codes:** `startTime` `required`, `endTime` `required` (POST) / `beforeStart` (not after the start: a 0-minute entry is refused too) / `notAllowed` (PUT with an end time on a live entry), `at` `required` / `invalid` (a Stop, or a Start making a stopped entry live again, before its start time).
- Shared code: API `Nala.Core/Entries/EntryTimer` (the Start / Stop rules on `ITimedEntry` / `ITimedEntryRepository`, results `TimerResult<TEntry>`), `EntryFields.ValidateStartEnd` and `EntryFields.ValidateTimerAt`; web `core/timers/stopped-entry.ts`, `core/time/live-longer-than.ts`, `core/time/span-seconds.ts` (`spanSeconds`), `core/time/after-start.ts` (the `beforeStart` validator).

### Live timer button
- While the section has a live entry for the selected baby, the card's + is replaced by a **timer button** (same small FAB and colours, `timer` icon, labelled "Open live <section>") that opens that entry's sheet (`EntrySheetService.edit`). Other kinds can be added again once the timers are stopped. The card finds the live entry through `RunningTimersService` (section + baby), so a new timer section gets it without its own code.

### Running timers mini-bar
- When any entry is live, the timers show **inside the bottom navigation bar's pill**, above the destinations and separated from them by a divider: one row per live entry with the section icon (in a small circle in the section's container colours), label, live duration (Durations format) and a chevron. The rows sit on the pill's translucent surface (no surface of their own); while they show, the pill widens and takes the M3 large corner. It is one surface: no separate bar above the navigation bar.
- The rows are a separate shared component (`nala-running-timers-bar`), projected into `nala-bottom-nav` by the app shell and loaded only once a timer runs (deferred, out of the initial bundle).
- When the family has more than one baby, each row also shows the baby's name, and timers of all babies are listed.
- Tapping a row opens that timer's entry sheet (`EntrySheetService.edit`).
- **Running timer sources:** a section with timers provides a source through `RUNNING_TIMER_SOURCES` (registered with `provideRunningTimerSource`): a signal of its live entries, each with an id, section, kind and the live entry, the baby, a label translation key (+ params) and its live duration in seconds at a given time. `RunningTimersService` merges them in registration order.

### Live sync
- Devices learn about other devices' timers by polling one endpoint for every section: `GET /api/live` → `{ feeds: [...], sleeps: [...], pumps: [...] }`, every baby's live entries per section, oldest start first, each in the section's usual JSON. Any signed-in member. A new timer section adds its own list there (`Nala.Api/Live/LiveEndpoints.cs`). No `ETag` / `304`: the answers are small, so they are always sent in full.
- The web app has **one shared poller** (`LiveSyncService`, `core/timers/`) that calls `/api/live` and hands each section's sync its list. Each section's sync (`LiveEntriesSync`, which `BreastfeedSyncService`, `SleepSyncService` and `PumpSyncService` extend) registers under its list's name; a section registering while the poller runs gets a poll at once (sections registering together share it).
- Own actions are applied at once; a response started before an own change is ignored (per-section version guard); changes waiting in the offline queue are applied on top by the section's overlay, following the server's rules (a tap already applied changes nothing), so an entry started offline runs, ticks and can be stopped or saved offline, also after the app is reopened. Sleep and Pump share their overlay (`applyQueuedTimedEntries`, `core/timers/queued-timed-entries.ts`).
- A failed call keeps the last lists. Polling pauses while the app is hidden and polls again as soon as it is shown, at once after sign-in and once the offline queue has been sent, and is cleared on sign-out.
- A screen that needs the server's live entries now (a sheet opening to add, or after a 409 on Start) asks the shared poller to poll at once (`refresh()` on the section's sync) and reads the section's list once it answers; no section calls an endpoint of its own.
- **Polling speed:** every **5 s** while any section has a live entry (any baby, waiting changes included), every **30 s** otherwise. It switches to 5 s as soon as a live entry appears (a Start on this device, or one seen from another device), and back to 30 s once none is left.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Home and order
- [x] Home shows one card per visible section, in a single column, in the user's order.
- [x] A new user gets the default order: Feed, Sleep, Diaper, Pump, Growth, Health; all visible.
- [x] In settings, a user can reorder sections (drag handles) and hide or show each one; at least one section must stay visible.
- [x] Order and visibility are saved per user on the server and apply on all their devices; other users are not affected.
- [x] Hiding a section only hides its card; its data is kept and still shown in the history of other members who display it.

### Section card
- [x] Every section card uses the shared section card component (header band, + button, highlight slot, show more / less, All activities).
- [x] Folded, the card lists the 3 most recent entries under the highlight.
- [x] "Show more" lists every entry of the last 24 hours (at least the 3 shown folded), loading more pages when needed; it is hidden when that adds nothing. "Show less" folds back to 3. The expanded state is remembered per device.
- [x] The history link reads "All activities" and opens the section's history page.
- [x] The + button and the Show more / Show less button use the section's colour tokens, not the app's primary colour.
- [x] With no entry yet, the highlight shows a section-specific empty state.
- [x] Time-since values ("26m ago") update live without reloading.
- [x] Card highlights never show seconds: time since and highlight durations show hours and minutes only, `>24h ago` / `>24h` from 24 hours on, and `just now` / `<1m` under a minute.

### + and entry sheet
- [x] + opens the kind picker when the section has several kinds, the entry sheet directly otherwise.
- [x] The entry sheet header uses the section colour and has ×, the kind title and Save.
- [x] × closes the sheet without saving changes; if there are unsaved changes, it asks for confirmation first.
- [x] Save is disabled while required fields are missing or invalid, and shows field errors.
- [x] Tapping an entry list item opens the same sheet pre-filled, with a Delete action.
- [x] A read-only row's trailing text (e.g. "Sleeping…", Duration, Total) has the same type style as a tappable row's value, in every section.
- [x] The sheet is usable one-handed on a phone: touch targets follow M3 minimums (48 × 48 dp). *(Tests check that only default-density Material controls are used; still to be checked by hand on a phone.)*

### Entry list item
- [x] Every entry list item has the same height: two lines, whatever the section or kind.
- [x] The headline shows the time, then the label after " · " when there is one.
- [x] The supporting text is one line, aligned with the headline, with an ellipsis when too long.
- [x] No duration bar is shown.

### Shared entry criteria
Hold for every section; each section's own test suites cover them for its entries (section specs tick them with one line).
- [x] Create (idempotent re-send), update, delete, get and the paged list (newest first, cursor, limit 1–50) follow the entry API conventions, with the section's codes.
- [x] Any member can edit or delete any entry; changes are saved with who edited it and when.
- [x] Entries logged by a deleted account still show that person's display name.
- [x] Entries are deleted with their baby (03).
- [x] An existing entry opens with its values; Save replaces them; × discards the form edits; Delete deletes it after confirmation.
- [x] With no network, adding, editing and deleting an entry are queued on the device and applied when back online; re-sending is idempotent (client UUIDs).

### Shared timed-entry criteria
Hold for every section with timers (Feed's breastfeed, Sleep, Pump); each covers them in its own test suites.
- [x] Start when no entry is live creates a live entry for the selected baby with start time = now; Stop ends it (no longer live); Start on it again makes it live again.
- [x] At most one live entry per baby: opening the sheet while one is live (e.g. from another device) opens that one, and with none live (even one stopped a minute ago) a new one; a Start refused with 409 opens the live one.
- [x] If a queued entry reaches the server while another is live for the same baby, both are kept.
- [x] The live entry is stored on the server; reloading or opening the app on another member's device shows the same state and duration, computed from stored timestamps.
- [x] Other devices see Start, Stop and edits within a few seconds without a manual refresh.
- [x] While an entry is live it appears in the mini-bar with its live duration; a stopped one doesn't.
- [x] A live entry is listed in the card and history from its first Start, with its live total.
- [x] With no network, every action that creates or changes it (Start, Stop, Save, manual entry, edit, delete) is queued on the device with its own time and applied when back online; an entry started offline keeps running and displaying on that device, also after the app is reopened.
- [x] A live entry older than the section's threshold shows its "Still …?" warning on the card and in the sheet.

### Timers
- [x] Save on a live entry saves the form and leaves its timers running.
- [x] × on a sheet opened to add, after a Start, deletes the entry that Start created (after confirmation), online and offline.
- [x] × on an existing live entry discards the form edits and keeps the timer taps made in the sheet.
- [x] Delete (live or stopped entry) deletes it after confirmation.
- [x] Only a live entry (a timer runs) shows the timer button and a mini-bar row; once its timers are stopped it is an ordinary entry.
- [x] A section card never shows a timer or timer controls: while an entry is live it keeps its normal highlight (or empty state).
- [x] While the section has a live entry for the selected baby, + is replaced by the timer button, which opens that entry's sheet.
- [x] Tapping a timer's duration (Sleep, Pump, each Breastfeed side) opens the duration dialog filled with it; there is no pencil.
- [x] A typed duration sets the end time to start + duration and never changes the start time; the timer shows the typed duration and Start / Stop is disabled until Save or ×.
- [x] Save after typing a duration on a live Sleep or Pump stores that end time, so it is no longer live; × keeps it running.

### Single-timer entries (Sleep, Pump)
- [x] Rows: Start time (set by Start, editable), End time (editable when not live, the section's "…ing…" while live), Duration (end − start, read-only), the section's own rows, Notes.
- [x] A past entry can be logged entirely by hand: start time and end time, then Save. Typing an end time disables Start until Save or ×.
- [x] Save is disabled when the end time is missing (not live) or not after the start time.
- [x] Start on a stopped entry makes it live again, its duration running from the original start time.

### Times
- [x] Times, dates and durations in the future are accepted in every section, by the app and the API (Feed, Breastfeed durations, Sleep, Pump, Diaper, Health, Growth, timer taps); the birth date still can't be in the future.
- [x] A time row edits the time with an hour field and a minute field (numeric keypad), exact to the minute; English has 1–12 with AM / PM, French 0–23.

### Offline queue
- [x] Changes made while the server can't be reached are queued on the device in order, each with its own time, and sent oldest first when back online; refused-for-good requests are dropped with a snackbar; a queued delete answered 404 counts as done.
- [x] If the session has expired while entries are queued, the queue is kept on the device; it is sent after the user logs in again, as the same user only.

### Bottom navigation bar
- [x] Every signed-in screen shows the floating bottom navigation bar with Dashboard, History, Trends and Settings, in that order, icons only with their names as accessible names; the current destination is marked active.
- [x] Signed-out screens don't show it.
- [x] The top app bar has no settings button; the settings page has no back link.
- [x] History (`/history`) and Trends (`/trends`) show a "Coming soon" empty state.
- [x] The last element of a page can scroll above the navigation bar.

### Safe areas & brand
- [x] `index.html` sets `viewport-fit=cover`.
- [x] Every screen starts below the top safe area plus 8 px, nothing when there is no safe area; the bottom sheets end above the bottom safe area.
- [x] The app shell has a fixed edge guard across the top edge, as tall as the top offset, in the page background colour; on iOS the top offset is at least 12 px. *(Tests check the markup and CSS; the missing blur is checked by hand on an iPhone.)*
- [x] The document doesn't rubber-band when pulled past its top or bottom (`overscroll-behavior-y: none`), so the bottom navigation bar stays in place.
- [x] The top app bar shows the Nala brand on the right, with one baby, several babies or none.
- [x] The brand shows "Nala" first and the lion's head after it, on the far right; the lion's head is 40 px, as tall as the baby's name + age block, and "Nala" uses `headline-small`.

### Mini-bar
- [x] The mini-bar appears on every screen as soon as a timer runs, and disappears when none runs.
- [x] It shows each live entry with a live duration and opens the matching entry sheet on tap.
- [x] While any timer runs, it reflects timers started, stopped or changed on other devices within 5 seconds.
- [x] When no timer runs, a timer started on another device shows within 30 seconds.
- [x] Its rows show inside the navigation bar's pill, above the destinations with a divider, and the pill takes the large corner only while timers show.
- [x] Each row's section icon sits in a circle in its section's container colours.

### Live sync
- [x] `GET /api/live` returns every baby's live feeds, live sleeps and live pumps, per section, oldest start first; stopped entries are left out; signed-out → 401.
- [x] The app makes one live request per tick, whatever the number of sections with timers; no section has an in-progress endpoint of its own.
- [x] It polls every 5 s while any section has a live entry and every 30 s otherwise, switching as soon as a live entry appears or the last one is gone.
- [x] Polling pauses while the app is hidden and runs at once when it is shown again, after sign-in, and once the offline queue has been sent.

### Theming
- [x] Each section has a colour token (and an "on colour" token for text/icons on it) defined in the global theme, with light and dark values. Components never hard-code these colours.
- [x] Each section also has container tokens (light and dark values), used by the card's + / timer button.
- [x] Everything inside a section uses that section's colour scheme, not the app's: the card (icons, empty state, highlight, entries, buttons), the section's history page, its kind picker, its entry sheets (rows, chips, toggles, switches, timers, buttons) and the dialogs and pickers they open. Screens outside a section keep the app scheme.

## Build slices

Built in 21 slices, all done; each is a commit "Spec 04 slice N: …" (`git log --grep "Spec 04 slice"`).

## Material 3 mapping

Use Angular Material's M3 components as-is. Customize only through the global theme (colour tokens, typography, density); do not override component shapes, sizes or internal styles in component CSS. When no Material component exists (e.g. the section card's header band, the bottom navigation bar), build it from Material surfaces and theme tokens, following M3 guidance.

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
| Form row | List item; editing through `mat-form-field` (hour and minute fields for a time), `mat-datepicker` |
| Single choice among 2–4 options (e.g. milk type) | Segmented button (`mat-button-toggle-group`) |
| Optional / multi choice (e.g. meal type, reaction, wet / dirty) | Filter chips (`mat-chip-listbox`) |
| On/off field (e.g. diaper rash) | Switch (`mat-slide-toggle`) |
| Primary / secondary actions | Filled / tonal / outlined / text buttons per M3 emphasis |
| Confirmation (delete, unsaved changes) | Dialog |
| Feedback after save / offline queued | Snackbar |
| Section reorder | Drag and drop (CDK) list with drag handle icons |
| Live timer button | Small FAB (`mat-mini-fab`) with the `timer` icon, in place of + |
| Bottom navigation bar | No Angular Material component: built from M3 navigation bar guidance (icon-only destinations with accessible names, active indicator pill) on a translucent surface, with router links |

## Data

- **User section preference:** user, section key, position, visible (PK user + key; deleted with the user).
- Section keys: `feed`, `sleep`, `diaper`, `pump`, `growth`, `health`.

## UI notes — shared components

- Shell: `nala-top-app-bar`, `nala-bottom-nav`, `nala-running-timers-bar`, empty state.
- Section: `nala-section-card` (with the live timer button, `[sectionBanner]` slot, `empty` input), `nala-kind-picker`, `nala-history-list` (`nalaHistoryEnd` end template), `nala-entry-list-item` (`dateOnly`).
- Entry sheet: `nala-entry-sheet`, `nala-sheet-header`, `nala-form-row`, `nala-suggestion-row`, `nala-notes-row`, `nala-entry-audit`, delete action, confirm dialog.
- Form rows: `nala-time-row` (`dateOnly`), `nala-chip-choice-row` (optional single choice as filter chips, translated or raw labels, optionally not clearable, optional `dotToken` colour dots and `error`), `nala-chip-toggles-row` (filter chips each bound to its own boolean), `nala-switch-row`, `nala-number-fields-row` (number fields side by side, each with its own suffix, bounds, step and error; a decimal `step` brings the decimal keyboard).
- Timers: `nala-timer`, `nala-split-timer`, `nala-duration-field` + `nala-duration-dialog`, `nala-banner`.
- Pipes: `nalaTimeSince`, `nalaHighlightDuration`, `nalaDuration`, `nalaEntryTime`, `nalaEntryDate`, `nalaLoadComponent`.

## What each section spec must define

- Kinds of entry (and their icons) and whether + opens a kind picker.
- Its fields, validation codes and any endpoint beyond the entry API conventions.
- Card highlight and empty state (the highlight stays the same while an entry is live).
- Entry list item summary per kind.
- Entry sheet rows per kind, defaults and suggestion rows.
- For a section with timers: its mini-bar label, its "Still …?" threshold and anything that differs from the Timers rules.

## Out of scope

- Totals, statistics and charts in cards or history (the Trends destination is a placeholder; its content comes with feature 12's spec).
- Home widgets other than section cards.
