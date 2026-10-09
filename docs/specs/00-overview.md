# Nala — overview

Source of truth for global decisions and the full feature list. Feature details live in one spec file per feature (see `_template.md`), written just before the feature is built.

## Vision

Self-hosted baby tracker PWA for parents: log a baby's feedings, sleep, diapers, growth and more, quickly and one-handed, and look back at the history.

## Global decisions

These change the data model or architecture. Changing one later means updating this section first.

- **Offline:** offline logging queue. Entries created without a network are queued on the device and sent when back online. Reading history needs the network. The PWA caches the app shell. Implication: entries get a client-generated UUID so re-sending a queued entry is idempotent.
- **Accounts & sharing:** one account per caregiver. **One instance = one family**: every user on the instance is a member of that family, joins it by invitation. Members have the same rights except destructive family actions (deleting a baby, removing a member), which only the admin can do. There is no family table in the data model. Every entry records who logged it; deleting an account never changes the entries it logged.
- **Registration on a self-hosted instance:** the first account created becomes the instance's only admin. After that, public sign-up is closed; new users join through invitation links sent by a family member.
- **Multiple babies:** a family has one or more babies. The app shows one selected baby at a time, with a quick switcher.
- **Time zones:** all times stored in UTC; each device displays them in its own local time zone.
- **Units:** metric only (ml, g/kg, cm).
- **Languages:** English and French at launch. Angular i18n from day one: no user-facing string is hard-coded outside translation files.
- **No photos and no reminders/notifications** anywhere in the app.
- **Activity model:** each activity type (feed, sleep, diaper…) is fully separate: its own entity, table and API endpoints, no shared base table. Because of the decisions above, every type still carries a client-generated UUID, the baby, who logged it and UTC timestamps. A combined timeline, if wanted later, has to aggregate across types explicitly.

## Features

Status: `idea` → `specified` → `in progress` → `done`. A feature moves to `specified` once its spec file exists and is agreed.

| # | Feature | Spec | Status | Notes |
|---|---------|------|--------|-------|
| 01 | Project skeleton (solution, Angular PWA, Docker Compose, test setups) | [01-project-skeleton.md](01-project-skeleton.md) | done | |
| 02 | Authentication (login, register, sessions) | [02-auth.md](02-auth.md) | done | |
| 03 | Family & baby profile | [03-family-baby.md](03-family-baby.md) | done | |
| 04 | App layout & section pattern (home cards, entry sheet, mini-bar, bottom navigation, timers) | [04-app-layout.md](04-app-layout.md) | done | Shared by every section: app shell, section pattern, entry API conventions, offline queue, timers, live sync and refresh on return (the reload signal). |
| 05 | Feed | [05-feed.md](05-feed.md) | done | **Hard requirement:** breast feeding has two independent per-side timers (left/right), side by side in the Breastfeed sheet. A single timer with a "side" field is not acceptable. |
| 06 | Sleep | [06-sleep.md](06-sleep.md) | done | One kind, single Start/Stop timer, start/end times, notes. |
| 07 | Diaper | [07-diaper.md](07-diaper.md) | done | Time, Wet and Dirty as two independent toggles (neither = dry), diaper-rash toggle, notes; a dirty diaper has optional colour and consistency. No timer. |
| 08 | Pump | [08-pump.md](08-pump.md) | done | **Hard requirement:** pumping sessions with volume and history. One Start/Stop timer (like Sleep), Left ml and Right ml, notes. |
| 09 | Health | [09-health.md](09-health.md) | done | Built as Medication, then renamed Health. Medicine name (recent names as chips), optional dose, optional temperature °C; at least a name or a temperature. Never gives dose advice nor interprets temperatures. |
| 10 | Growth | [10-growth.md](10-growth.md) | done | **Hard requirement:** simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts. Birth measurements (03) are the starting point of the growth history. |
| 11 | History (all sections) | [11-history.md](11-history.md) | in progress | The bottom bar's History destination: every selected section's entries together, newest first, filtered by time window (24 h / 7 days / 30 days) and sections, remembered per device. Replaces the per-section history pages: a card's All activities opens it for that section. |
| 12 | Trends | — | idea | The bottom bar's Trends destination (placeholder built in 04). Content to decide in its spec: today totals, statistics and charts are out of scope everywhere else. |

## Build plan

Specs are numbered in build order: build 01, then 02, and so on. If the order of the remaining sections changes, renumber them before building. Each spec is split into **vertical slices** (small end-to-end increments: DB → API → UI), listed in a "Build slices" section of the spec and approved before the first one is built. Each slice goes red → green → commit on `master`. Use `/slice <spec number>` to build the next slice.

When a spec is done, keep it describing the app as it is, not how it got there: fold every change into its Decisions and Acceptance criteria (rewrite or remove what changed, never append a contradicting paragraph) and collapse its Build slices to one line pointing at the commits (`git log --grep "Spec NN slice"`). Rules shared by several sections go into spec 04, not into each section spec.

Spec each remaining feature (12) before building it.
