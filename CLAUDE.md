# Nala

Open source baby tracker PWA for parents, self-hostable with Docker. It tracks a baby's feedings, sleep, diapers, growth and milestones over time. Licensed GPL-3.0.

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
tests/deploy/          # deployment checks
```

Deployment checks (from the root, Docker needed): `node --test "tests/**/*.test.mjs"` (compose and Dockerfiles), `tests/deploy/smoke.sh` (full stack from a clean copy).

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

## Specs

Specs live in `docs/specs/`. The overview (global decisions + full feature list) is loaded below:

@docs/specs/00-overview.md

- Before working on a feature, read its spec in `docs/specs/`. If it has no spec yet, write one with the user (from `_template.md`) before coding.
- A feature is done only when every acceptance criterion in its spec has a passing test.
- If a decision changes during implementation, update the spec first, then the code.
- Any new feature idea goes into the overview's feature list immediately, even as a one-liner, so nothing gets lost.
