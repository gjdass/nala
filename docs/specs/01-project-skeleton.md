# 01 — Project skeleton

Status: done

## Goal

Prove the whole chain — Angular PWA → nginx → API → PostgreSQL, built and run with Docker Compose — before any feature is written, with both test suites in place. This is the first build step.

## Acceptance criteria

Each item becomes at least one test or check, written failing first where testable.

### API
- [x] `api/` contains a .NET solution (current LTS) with `Nala.Api`, `Nala.Core`, `Nala.Sql`, `Nala.Tests`, referencing each other as described in `api/CLAUDE.md` (Core references nothing).
- [x] `Nala.Tests` uses NUnit and `dotnet test` runs green from `api/`.
- [x] `Nala.Sql` has a `DbContext` on PostgreSQL (Npgsql) and an initial migration; the API applies pending migrations at startup.
- [x] `GET /api/health` returns 200 with `{ "status": "ok" }` when the database is reachable, 503 (`{ "status": "unavailable" }`) otherwise.
- [x] The connection string comes from an environment variable (`ConnectionStrings__Nala`).

### Web
- [x] `web/` contains an Angular app (current version): standalone components, installable PWA (manifest, icons, service worker for the app shell).
- [x] Angular Material with a Material 3 theme defined globally under `src/styles/`, light and dark, following the system preference; a theme service supports light / dark / system and persists the choice per device.
- [x] Section colour tokens exist in the global theme as placeholders (light and dark), ready for 04.
- [x] A lint check fails on hard-coded colours (hex, `rgb()`, `hsl()`, named colours) in component style files.
- [x] Runtime i18n (EN/FR) is set up with a translation library that can switch language without reloading (the language is a per-user setting, see 02); no user-facing string outside translation files.
- [x] The unit test runner runs green.
- [x] A placeholder home page calls `/api/health` and shows the result; in development, `/api` is proxied to the local API. *(The placeholder was replaced by the section home in 04 slice 2; the health endpoint and the smoke check remain.)*

### Docker
- [x] Multi-stage Dockerfiles for `api` (SDK build → ASP.NET runtime) and `web` (node build → nginx).
- [x] nginx serves the Angular build (SPA fallback to `index.html`) and reverse-proxies `/api` to the `api` container.
- [x] `docker-compose.yml` defines `db` (PostgreSQL, named volume, healthcheck), `api` (waits for a healthy `db`) and `web` (the only published port).
- [x] `.env.example` lists every variable compose needs, with placeholder values.
- [x] From a clean clone: `cp .env.example .env && docker compose up -d --build` → the app opens in a browser and shows the API health as ok.

### Docs
- [x] The "Commands" sections of `web/CLAUDE.md` and `api/CLAUDE.md` list the real commands (run, test, lint, build, add migration).
- [x] `README.md` explains how to deploy with Docker Compose.

## Build slices

Each slice goes red → green → commit on `master`, in this order.

- [x] **Slice 1 — API skeleton + health endpoint.** .NET 10 solution with the four projects and their references, NUnit, `NalaDbContext` (Npgsql) with an initial migration applied at startup, `GET /api/health` (200 / 503), connection string from an environment variable, `api/CLAUDE.md` commands. Covers: all API criteria, api half of Docs / Commands.
- [x] **Slice 2 — Web skeleton + health page + i18n.** Angular app (standalone, OnPush, signals), installable PWA (manifest, icons, service worker), unit test runner, runtime EN/FR i18n switchable without reload, placeholder home page calling `/api/health` through the dev proxy, `web/CLAUDE.md` commands. Covers: Web criteria 1, 5, 6, 7, web half of Docs / Commands.
- [x] **Slice 3 — Material 3 theme, theme service, colour lint.** Global M3 theme under `src/styles/` (light and dark, system preference), `ThemeService` (light / dark / system, persisted per device), placeholder section colour tokens (`feed`, `sleep`, `diaper`, `pump`, `growth`, `health` (was `medication`, renamed by spec 09), each with an "on" colour, light and dark), stylelint rule rejecting hard-coded colours in component styles, health page restyled with Material. Covers: Web criteria 2, 3, 4.
- [x] **Slice 4 — Docker Compose deployment.** Multi-stage Dockerfiles (`api`: SDK → ASP.NET runtime; `web`: node → nginx with SPA fallback and `/api` proxy), `docker-compose.yml` (`db` with named volume and healthcheck, `api` waiting for healthy `db`, `web` the only published port), `.env.example`, README deployment section, scripted smoke check from a clean clone. Covers: all Docker criteria, README criterion.

## Decisions

- **i18n library:** Transloco (`@jsverse/transloco`), runtime language switching. Translation files are `web/public/i18n/en.json` and `fr.json`, fetched over HTTP and cached by the service worker.
- **Initial language:** the first of EN/FR in the browser's language preferences, else English, until the per-user setting (spec 02) replaces it.
- **Web test runner:** Vitest through the Angular CLI (`ng test`). Checks that need Node (compiling the SCSS theme, running stylelint) are Node test-runner tests in `web/tools/` (`npm run test:tooling`).
- **Theme:** Angular Material M3 with `theme-type: color-scheme`: every colour token is a `light-dark()` value, so the theme follows the system preference, and `ThemeService` forces light or dark by setting `color-scheme` on `<html>`. The choice is stored per device in `localStorage` (`nala.theme`); default `system`. Palette: Material's default (azure) until decided.
- **Section colour tokens:** `--nala-section-<key>` (surface) and `--nala-on-section-<key>` (text/icons on it) for `feed`, `sleep`, `diaper`, `pump`, `growth`, `health` (was `medication`), defined in `web/src/styles/_sections.scss`. Placeholder values from Material's M3 palettes (tone 40/80 for the colour, 100/20 for the on-colour, light/dark): feed orange, sleep violet, diaper cyan, pump rose, growth green, health red.
- **Font:** Roboto bundled with the app (`@fontsource/roboto`), no Google Fonts request.
- **Colour lint:** stylelint on component styles (`src/app/**/*.scss`) rejects hex, named colours and colour functions (`rgb()`, `hsl()`, `oklch()`…). Theme files under `src/styles/` are the only place colours are defined.

- **Deployment:** the `web` host port comes from `NALA_HTTP_PORT` (default 8080); `db` and `api` publish nothing. PostgreSQL 18 (`postgres:18-alpine`, same as the tests) with the named volume `nala-db` mounted at `/var/lib/postgresql` (the PG 18 layout). Both runtime images are non-root and listen on 8080 (`aspnet:10.0` as `app`, `nginx-unprivileged`). The stack serves plain HTTP; HTTPS is the host's own reverse proxy, documented in the README. Deployment checks live in `tests/deploy/` (Node test runner on the resolved compose model, plus `smoke.sh` from a clean copy).

## Out of scope

- Any feature (authentication comes next, in 02).
- CI pipelines.
