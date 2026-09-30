# Nala web (Angular PWA)

## Commands

Run from `web/` (Node 24, npm).

| What | Command |
|---|---|
| Install | `npm ci` |
| Dev server (http://localhost:4200, `/api` proxied to the local API on :5267 via `proxy.conf.json`) | `npm start` |
| Unit tests (Vitest, single run) | `npm test -- --watch=false` |
| Tooling tests (theme compiles with its tokens, colour lint rules), Node's test runner | `npm run test:tooling` |
| Lint (ESLint + stylelint colour check on `src/app/**/*.scss`) | `npm run lint` |
| Build (production, with service worker) | `npm run build` |

- i18n: Transloco, runtime switching. Translations live in `public/i18n/{en,fr}.json`; both files must have the same keys (enforced by `translations.spec.ts`). Signed-out screens use the browser's language (first of EN/FR it prefers), falling back to English; once signed in, `provideUserLanguage()` (`core/i18n/user-language.ts`) switches to the user's preferred language.
- The service worker is only enabled in production builds.
- Docker: `web/Dockerfile` (node build → unprivileged nginx on 8080). `nginx.conf` serves `dist/nala/browser` with SPA fallback, proxies `/api/` to `api:8080` and keeps `index.html`/`ngsw.json`/the worker uncached.
- Theme: `src/styles/` (`_theme.scss` Material 3 theme, `_sections.scss` section tokens `--nala-section-<key>` / `--nala-on-section-<key>` and `-container` variants, plus the `.nala-section-fab` / `.nala-section-text-button` Material overrides the section card uses, `_typography.scss` bundled Roboto and Material Symbols Outlined, the `mat-icon` font set via `provideNalaIcons()`). Colours are `light-dark()` values; `ThemeService` (`core/theme/`) sets `color-scheme` on `<html>` to force light/dark, and persists the choice in `localStorage` (`nala.theme`).

## Architecture

- Standalone components, signals, `OnPush` change detection, built-in control flow (`@if`, `@for`).
- `src/app/shared/ui/` — reusable presentational components (card, button, timer, list item, empty state…). Prefix: `nala-`.
- `src/app/features/<activity>/` — one folder per activity (feed, sleep, diaper, growth, pump, medication…). Features compose shared UI components; they don't restyle Material directly.
- `src/app/core/` — API client services, models, interceptors, app-wide services (theme, etc.).
- Talk to the backend through `/api` (same origin, proxied by nginx in prod and by the Angular dev proxy locally).

## Components

- Prefer an existing shared component over new markup. If one is almost right, extend it (inputs, content projection) instead of forking it.
- Keep components small: presentational components take inputs and emit outputs, and data fetching lives in services.
- Every component and service gets a unit test written **before** the implementation (see root `CLAUDE.md`).

## Design and theming

- Angular Material (Material 3) for all UI building blocks, used as designed and following the Material 3 guidelines (e.g. FAB shape, button types by emphasis, chips vs segmented buttons). Reference screenshots in specs define layout and flow only, never element styling.
- Customize Material only through the global theme (color tokens, typography, density). Don't override component shapes, sizes or internals in component styles. `docs/specs/04-app-layout.md` maps each UI pattern to its Material component.
- **No hard-coded colors in components**: no hex, `rgb()`, `hsl()` or named colors in component styles or templates. Components only use theme tokens (`var(--mat-sys-*)` or app tokens defined in the global theme).
- All color definitions live in the global theme files under `src/styles/`. The palette is not decided yet, so use a Material default palette until it is.
- Light and dark themes are both required. The theme follows the system preference by default and can be overridden by the user (light / dark / system), with the choice persisted.
- Test every new screen in both themes.

## PWA

- Installable (manifest + icons) with a service worker for app-shell caching.
- Must be usable on a phone one-handed: mobile-first layouts, large touch targets.
