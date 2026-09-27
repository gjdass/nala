# Nala

Open source baby tracker PWA for parents (similar to Nara Baby), self-hostable with Docker. It tracks a baby's feedings, sleep, diapers, growth and milestones over time. Licensed GPL-3.0.

Functional specs will be added later. This file covers the technical baseline.

## Stack

| Layer    | Tech                                                    | Folder |
|----------|---------------------------------------------------------|--------|
| Frontend | Angular PWA + Angular Material                          | `web/` |
| Backend  | C# / ASP.NET Core Web API                               | `api/` |
| Database | PostgreSQL via Entity Framework Core (Npgsql)           | —      |
| Deploy   | Docker Compose (`db`, `api`, `web`)                     | root   |

`web/CLAUDE.md` and `api/CLAUDE.md` hold the layer-specific rules. Read them when working in those folders.

## Repository layout

```
docker-compose.yml     # prod stack: db + api + web
.env.example           # every variable compose needs, with safe placeholder values
web/                   # Angular app (own Dockerfile)
api/                   # .NET solution (own Dockerfile)
```

## Development workflow: test first, always

Every feature and every bug fix follows red → green → refactor:

1. Write the unit test(s) describing the expected behavior or reproducing the bug.
2. Run them and **confirm they fail** for the right reason (red). Show the failing output.
3. Implement the minimum code to make them pass (green).
4. Refactor with the tests still green.

Don't write production code before a failing test exists for it. Don't call a task done until the full test suites of the touched layer pass.

## Reuse over duplication

- Build UI from shared, reusable components (card, button, list item, form fields, dialogs, timers…). Before creating a component, check whether an existing one can be used or extended.
- Same on the backend: shared logic lives in `Nala.Core`, not copy-pasted across controllers.

## Deployment

- Everything must run with a single `docker compose up -d --build` on the prod host. The images are built there.
- Multi-stage Dockerfiles: SDK/node build stage → slim runtime stage.
- `web` is served by nginx, which also reverse-proxies `/api` to the `api` container, so the app has a single origin.
- The API applies EF Core migrations at startup.
- All config comes from environment variables (`.env`, never committed). Keep `.env.example` up to date whenever a variable is added.
- Postgres data lives in a named volume.

## Product requirements (hard, have been dropped before)

Activity types in scope: **Feed, Diaper, Sleep, Medication, Growth, Pump**. Always check these when touching the related area:

- **Breast feeding uses two independent timers, one per side (left / right).** Each side starts and stops on its own; the feed card is split into a left/right layout. A single timer with a "side" field is not acceptable.
- **Growth** section: simple measurement entries over time — weight, height, head circumference, milestones. Raw logging only, no percentile/trend charts.
- **Pump** section: pumping sessions with volume and history.
