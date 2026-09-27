# 04 — Project skeleton

Status: specified

## Goal

Prove the whole chain — Angular PWA → nginx → API → PostgreSQL, built and run with Docker Compose — before any feature is written, with both test suites in place. This is build step 0.

## Acceptance criteria

Each item becomes at least one test or check, written failing first where testable.

### API
- [ ] `api/` contains a .NET solution (current LTS) with `Nala.Api`, `Nala.Core`, `Nala.Sql`, `Nala.Tests`, referencing each other as described in `api/CLAUDE.md` (Core references nothing).
- [ ] `Nala.Tests` uses NUnit and `dotnet test` runs green from `api/`.
- [ ] `Nala.Sql` has a `DbContext` on PostgreSQL (Npgsql) and an initial migration; the API applies pending migrations at startup.
- [ ] `GET /api/health` returns 200 with `{ "status": "ok" }` when the database is reachable, 503 otherwise.
- [ ] The connection string comes from an environment variable.

### Web
- [ ] `web/` contains an Angular app (current version): standalone components, installable PWA (manifest, icons, service worker for the app shell).
- [ ] Angular Material with a Material 3 theme defined globally under `src/styles/`, light and dark, following the system preference; a theme service supports light / dark / system and persists the choice per device.
- [ ] Section colour tokens exist in the global theme as placeholders (light and dark), ready for 03.
- [ ] A lint check fails on hard-coded colours (hex, `rgb()`, `hsl()`, named colours) in component style files.
- [ ] Runtime i18n (EN/FR) is set up with a translation library that can switch language without reloading (the language is a per-user setting, see 01); no user-facing string outside translation files.
- [ ] The unit test runner runs green.
- [ ] A placeholder home page calls `/api/health` and shows the result; in development, `/api` is proxied to the local API.

### Docker
- [ ] Multi-stage Dockerfiles for `api` (SDK build → ASP.NET runtime) and `web` (node build → nginx).
- [ ] nginx serves the Angular build (SPA fallback to `index.html`) and reverse-proxies `/api` to the `api` container.
- [ ] `docker-compose.yml` defines `db` (PostgreSQL, named volume, healthcheck), `api` (waits for a healthy `db`) and `web` (the only published port).
- [ ] `.env.example` lists every variable compose needs, with placeholder values.
- [ ] From a clean clone: `cp .env.example .env && docker compose up -d --build` → the app opens in a browser and shows the API health as ok.

### Docs
- [ ] The "Commands" sections of `web/CLAUDE.md` and `api/CLAUDE.md` list the real commands (run, test, lint, build, add migration).
- [ ] `README.md` explains how to deploy with Docker Compose.

## Out of scope

- Any feature (auth comes in step 1).
- CI pipelines.
