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
| 01 | Authentication (login, register, sessions) | [01-auth.md](01-auth.md) | specified | |
| 02 | Family & baby profile | [02-family-baby.md](02-family-baby.md) | specified | |
| 03 | App layout & section pattern (home cards, entry sheet, mini-bar) | [03-app-layout.md](03-app-layout.md) | specified | Shared by every section. |
| 04 | Project skeleton (solution, Angular PWA, Docker Compose, test setups) | [04-project-skeleton.md](04-project-skeleton.md) | specified | Build step 0. |
| 10 | Feed | [10-feed.md](10-feed.md) | specified | **Hard requirement:** breast feeding has two independent per-side timers (left/right), side by side in the Breastfeed sheet. A single timer with a "side" field is not acceptable. |
| 11 | Sleep | — | idea | |
| 12 | Diaper | — | idea | From the reference screenshots: time, wet / dirty / dry selector, diaper-rash toggle, notes. |
| 13 | Medication | — | idea | |
| 14 | Growth | — | idea | Birth weight/length/head circumference are stored on the baby profile (02) and must appear as the starting point of the growth history. **Hard requirement:** simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts. |
| 15 | Pump | — | idea | **Hard requirement:** pumping sessions with volume and history. |

## Build plan

Built in this order, one spec at a time. Each spec is split into **vertical slices** (small end-to-end increments: DB → API → UI), listed in a "Build slices" section of the spec and approved before the first one is built. Each slice goes red → green → commit on `master`. Use `/slice <spec number>` to build the next slice.

| Step | Spec | Notes |
|------|------|-------|
| 0 | 04 Project skeleton | Whole chain incl. `docker compose up` before any feature |
| 1 | 01 Authentication | First-run setup → login/session → invitations → reset → account settings → admin |
| 2 | 02 Family & baby profile | |
| 3 | 03 App layout & section pattern | Shared components, home column, per-user order |
| 4 | 10 Feed | Slices: bottle → solids → breastfeed timers → live sync + mini-bar → offline queue |
| 5+ | Remaining sections | Spec each one (Sleep, Diaper, Medication, Growth, Pump) before building it |
