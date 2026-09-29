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
| 04 | App layout & section pattern (home cards, entry sheet, mini-bar) | [04-app-layout.md](04-app-layout.md) | specified | Shared by every section. |
| 05 | Feed | [05-feed.md](05-feed.md) | specified | **Hard requirement:** breast feeding has two independent per-side timers (left/right), side by side in the Breastfeed sheet. A single timer with a "side" field is not acceptable. |
| 06 | Sleep | — | idea | |
| 07 | Diaper | — | idea | From the reference screenshots: time, wet / dirty / dry selector, diaper-rash toggle, notes. |
| 08 | Medication | — | idea | |
| 09 | Growth | — | idea | Birth weight/length/head circumference are stored on the baby profile (03) and must appear as the starting point of the growth history. **Hard requirement:** simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts. |
| 10 | Pump | — | idea | **Hard requirement:** pumping sessions with volume and history. |

## Build plan

Specs are numbered in build order: build 01, then 02, and so on. If the order of the remaining sections changes, renumber them before building. Each spec is split into **vertical slices** (small end-to-end increments: DB → API → UI), listed in a "Build slices" section of the spec and approved before the first one is built. Each slice goes red → green → commit on `master`. Use `/slice <spec number>` to build the next slice.

Notes per step:
- **01 Project skeleton:** the whole chain, incl. `docker compose up`, before any feature.
- **02 Authentication:** first-run setup → login/session → invitation registration → account settings → account deletion → admin → admin reset link → email reset.
- **04 App layout:** shared components, home column, per-user order.
- **05 Feed:** slices bottle → solids → breastfeed timers → live sync + mini-bar → offline queue.
- **06+:** spec each remaining section before building it.
