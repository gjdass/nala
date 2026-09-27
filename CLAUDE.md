# Nala

Open source baby life tracker PWA for parents, self-hostable with Docker. Licensed GPL-3.0.

## Stack

_TBD — fill in once chosen (frontend, backend, storage, Docker setup)._

## Commands

_TBD — dev server, tests, lint, build, docker compose._

## Product requirements

Activity types in scope: **Feed, Diaper, Sleep, Medication, Growth, Pump**.

Hard requirements that have been dropped in the past — always check them when touching the related area:

- **Breast feeding uses two independent timers, one per side (left / right).** Each side starts and stops on its own; the feed card is split into a left/right layout. A single timer with a "side" field is not acceptable.
- **Growth** section: simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts.
- **Pump** section: pumping sessions with volume and history.

## Conventions

_TBD — code style, naming, commit format._
