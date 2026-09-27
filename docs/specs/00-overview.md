# Nala — overview

Source of truth for global decisions and the full feature list. Feature details live in one spec file per feature (see `_template.md`), written just before the feature is built.

## Vision

Self-hosted baby tracker PWA for parents: log a baby's feedings, sleep, diapers, growth and more, quickly and one-handed, and look back at the history.

## Global decisions

These change the data model or architecture. Changing one later means updating this section first.

- **Offline:** offline logging queue. Entries created without a network are queued on the device and sent when back online. Reading history needs the network. The PWA caches the app shell. Implication: entries get a client-generated UUID so re-sending a queued entry is idempotent.
- **Accounts & sharing:** one account per caregiver. Caregivers share a **family** and join it by invitation. A user belongs to exactly one family. Every entry records who logged it; deleting an account never changes the entries it logged.
- **Registration on a self-hosted instance:** the first account created becomes the instance's only admin. After that, public sign-up is closed; new users join through invitation links sent by a family member.
- **Multiple babies:** a family has one or more babies. The app shows one selected baby at a time, with a quick switcher.
- **Time zones:** all times stored in UTC; each device displays them in its own local time zone.
- **Units:** metric only (ml, g/kg, cm).
- **Languages:** English and French at launch. Angular i18n from day one: no user-facing string is hard-coded outside translation files.
- **Activity model:** each activity type (feed, sleep, diaper…) is fully separate: its own entity, table and API endpoints, no shared base table. Because of the decisions above, every type still carries a client-generated UUID, the baby, who logged it and UTC timestamps. A combined timeline, if wanted later, has to aggregate across types explicitly.

## Features

Status: `idea` → `specified` → `in progress` → `done`. A feature moves to `specified` once its spec file exists and is agreed.

| # | Feature | Spec | Status | Notes |
|---|---------|------|--------|-------|
| 01 | Authentication (login, register, sessions) | [01-auth.md](01-auth.md) | specified | |
| 02 | Family & baby profile | — | idea | |
| 10 | Feed | — | idea | **Hard requirement:** breast feeding has two independent timers, one per side (left/right). Each side starts and stops on its own; the card is split left/right. A single timer with a "side" field is not acceptable. |
| 11 | Sleep | — | idea | |
| 12 | Diaper | — | idea | |
| 13 | Medication | — | idea | |
| 14 | Growth | — | idea | **Hard requirement:** simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts. |
| 15 | Pump | — | idea | **Hard requirement:** pumping sessions with volume and history. |
