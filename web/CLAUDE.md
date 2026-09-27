# Nala web (Angular PWA)

## Commands

_Fill in once scaffolded (dev server, unit tests, lint, build)._

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
- Customize Material only through the global theme (color tokens, typography, density). Don't override component shapes, sizes or internals in component styles. `docs/specs/03-app-layout.md` maps each UI pattern to its Material component.
- **No hard-coded colors in components**: no hex, `rgb()`, `hsl()` or named colors in component styles or templates. Components only use theme tokens (`var(--mat-sys-*)` or app tokens defined in the global theme).
- All color definitions live in the global theme files under `src/styles/`. The palette is not decided yet, so use a Material default palette until it is.
- Light and dark themes are both required. The theme follows the system preference by default and can be overridden by the user (light / dark / system), with the choice persisted.
- Test every new screen in both themes.

## PWA

- Installable (manifest + icons) with a service worker for app-shell caching.
- Must be usable on a phone one-handed: mobile-first layouts, large touch targets.
