# 12 — Trends

Status: specified

Builds on [04 — App layout](04-app-layout.md): the app shell, the section registry and colour schemes, the home section order and the reload signal apply. This spec adds the Trends destination's content, which replaces 04's "Coming soon" placeholder.

## Goal

On the Trends tab, show how the selected baby's feeding, sleep, diapers, pumping and growth evolve over a chosen period, one section at a time, with simple charts readable on a phone.

## Decisions

### Page
- `/trends` keeps the shared top app bar (baby switcher and brand) and has no page title, as History. Then the filter bar, then the section's **metric cards**, stacked vertically. Without a baby, the page shows 03's empty state.
- **Read only:** no + button, no entry opened from a chart.
- **Raw facts only:** no "normal" ranges, targets, percentiles, scores or advice, anywhere on the page.

### Filter bar
- Sticky under the top edge guard, as History's. Two dropdown chips side by side (History's chip and menu pattern), then the period navigation:
  - **Section** (single choice, `menuitemradio`): the sections that have trends, i.e. **Feed, Sleep, Diaper, Pump and Growth**, in the home order (visible ones, a divider, then hidden ones; default order while the home order isn't loaded). **Health has no trends.** Default: the first section with trends that is visible on home.
  - **Range** (`menuitemradio`): **7 days** (default), **30 days**, **3 months**, **6 months**, **Since birth**.
  - **Period navigation:** ‹ and › around the period's label ("3 – 9 Oct", "Jul – Oct 2026"). ‹ shows the period of the same length just before; › the one after, disabled on the current period. Nothing goes before the birth date (‹ disabled once the period reaches it). Not shown for Since birth.
- Periods are **whole local days**, ending today: 7 days = today and the 6 days before; 3 months = from the same day 3 months ago + 1 day to today. Changing the range or the section goes back to the current period.
- **Remembered per device:** `localStorage` `nala.trendsFilters` `{ section, range }` (not the period offset), restored when Trends is opened. An unknown or no-longer-eligible section falls back to the default, an unknown range to 7 days.

### Buckets
- The period decides the bar size: **up to 31 days → one bar per day**; up to 6 months → one bar per **week**; longer → one bar per **month**. Weeks start on the locale's first day of the week (Monday in French).
- A week or month bar shows the **daily average** over its days with data, so bars stay comparable whatever the bucket.
- **A day with no entry of the section is "no data", not zero:** it has no bar and stays out of every average. A day with at least one entry of the section is a data day, so its other metrics can be a true zero (a day of breastfeeds has 0 ml of bottle).
- **Today is incomplete:** its daily bar is drawn in a lighter tone, and it's left out of the headline averages and of week / month bars.
- Days are **local days in the device's time zone**. A sleep, a breastfeed side or a pump session that crosses midnight has its duration split across both days. Counts and volumes go to the day of the entry's start time. A live entry counts up to now.

### Metric cards
- Each card: the metric's title, a **headline** for the whole period (above the chart, M3 headline typescale) and a full-width chart about 160 px tall, in the section's colour scheme. Tapping a bar or a point shows its date (or week / month) and value; tapping elsewhere hides it. No zoom, no scroll inside a chart.
- With no data day in the period, the card shows "Nothing logged in this period" instead of the chart.
- Headlines are **daily averages over the data days of the period** (today excluded), unless stated otherwise.

| Section | Card | Chart | Headline |
|---|---|---|---|
| Feed | Feeds | bars stacked by kind: breastfeed, bottle, solids | feeds per day |
| Feed | Bottle | ml, stacked breast milk / formula | ml per day |
| Feed | Breastfeeding | minutes, stacked left / right | minutes per day, and the left / right split over the period ("L 55 % · R 45 %") |
| Feed | Time between feeds | average gap per day | average gap ("2h 40m") |
| Sleep | Sleep | hours, stacked day / night | hours per day |
| Sleep | Longest sleep | longest single sleep per day | average longest sleep |
| Diaper | Diapers | two bars side by side: wet, dirty (a wet and dirty diaper counts in both) | wet per day · dirty per day |
| Pump | Pumped | ml, stacked left / right | ml per day |
| Pump | Sessions | sessions per day | sessions per day |
| Growth | Weight / Length / Head | one line chart each (see Growth) | latest value and its date |

- **Time between feeds:** the gap from one feed's start to the next feed's start, counted on the day of the later feed. **Gaps over 8 hours are ignored** (a night or a stretch nobody logged). A day with a single feed has no gap value.
- **Night:** **19:00 to 07:00 local**, fixed. A sleep's minutes inside that window are night, the others day. The longest sleep counts on the day it starts.
- Durations use spec 04's highlight duration format; ml and counts are rounded to whole numbers, averages of counts to one decimal ("6.4").

### Growth
- No buckets: each measure (weight in kg, length in cm, head circumference in cm) is a **line chart of its values in the period**, a point per measurement, joined by lines, with the birth measurement (03) as the first point when it falls in the period. The x axis is dated; the tooltip gives the date, the value and the baby's age then.
- **Milestones** show as small markers along the weight chart's x axis; tapping one shows its name and date.
- A measure with fewer than two points in the period shows its point(s) without a line; none: "Nothing logged in this period".
- This is where growth curves live: the Growth section on home stays raw logging (spec 10), and there are no percentile or WHO curves anywhere.

### Architecture
- **Aggregation in the API**, per section (the overview: aggregate across types explicitly), shared day-splitting logic in `Nala.Core`:
  - `GET /api/babies/{babyId}/trends/{section}?from=yyyy-MM-dd&to=yyyy-MM-dd&tz=<IANA zone>` for `feeds`, `sleeps`, `diapers`, `pumps` → `{ days: [{ date, …metrics }] }`, only the data days, in date order. Metrics per day:
    - feeds: `count: { breastfeed, bottle, solids }`, `bottleMl: { breastMilk, formula }`, `breastSeconds: { left, right }`, `gapSecondsSum`, `gapCount`;
    - sleeps: `daySeconds`, `nightSeconds`, `longestSeconds`;
    - diapers: `wet`, `dirty`, `count`;
    - pumps: `leftMl`, `rightMl`, `sessions`.
  - `GET /api/babies/{babyId}/trends/growth?from=…&to=…` → `{ measurements: [{ date, weightG, lengthCm, headCircumferenceCm, birth }], milestones: [{ date, milestone, title }] }`.
  - Codes: `from` / `to` `required` / `invalid`, `to` `beforeFrom`, `tz` `required` / `invalid`; another family's or an unknown baby → 404 as the other baby endpoints.
- The web regroups days into weeks / months and computes the headlines. Reading needs the network (overview); an error shows Try again. The page reloads on the reload signal (04), a baby switch and a filter change.

## User stories

- As a parent, I want to see how many feeds and how much milk my baby took each day over the last weeks, so I can see the change as they grow.
- As a breastfeeding parent, I want to see the balance between left and right over time.
- As a parent, I want to see if my baby sleeps more, and in longer stretches, over the months.
- As a parent, I want to check wet and dirty diapers per day in the first weeks.
- As a pumping parent, I want to follow my daily volume.
- As a parent, I want to see my baby's weight, length and head circumference since birth on a curve.
- As a parent, I want to look back at a past period, not just the last days.

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Page
- [ ] `/trends` shows the top app bar, the filter bar and the selected section's metric cards; no page title, no + button. Without a baby, 03's empty state.

### Filter bar
- [ ] The Section chip offers Feed, Sleep, Diaper, Pump and Growth in home order (visible, divider, hidden), never Health; default: the first visible one.
- [ ] The Range chip offers 7 days (default), 30 days, 3 months, 6 months and Since birth.
- [ ] ‹ shows the previous period of the same length and › the next one; › is disabled on the current period, ‹ once the period reaches the birth date; no arrows for Since birth. The label shows the period's dates.
- [ ] Changing the section or the range goes back to the current period.
- [ ] Section and range are remembered on the device; an unknown or ineligible stored value falls back to the default.

### Buckets
- [ ] Up to 31 days: one bar per day; up to 6 months: per week (locale's first day); longer: per month. Week and month bars show the daily average over their data days.
- [ ] A day without an entry of the section has no bar and is left out of averages; a data day's metric can be zero.
- [ ] Today's bar is lighter and today is left out of headlines and week / month bars.
- [ ] Durations crossing midnight are split across both local days; counts and volumes go to the start day; a live entry counts up to now.

### Metric cards
- [ ] Each section shows the cards of the table above, with their headline and chart, in the section's colours.
- [ ] Tapping a bar or point shows its date and value.
- [ ] A card with no data day in the period shows "Nothing logged in this period".
- [ ] Time between feeds ignores gaps over 8 hours and counts each gap on the later feed's day.
- [ ] Sleep minutes between 19:00 and 07:00 local count as night; the longest sleep counts on its start day.
- [ ] Breastfeeding headline shows the period's left / right split.

### Growth
- [ ] Weight, length and head circumference each show a line of their measurements in the period, the birth measurement first when in the period; the tooltip shows date, value and age.
- [ ] Milestones show as markers on the weight chart.

### API
- [ ] Each trends endpoint returns only the baby's data days in the range, aggregated in the given time zone, as described above.
- [ ] Invalid or missing `from`, `to`, `tz` return their codes; another family's baby returns 404.

## Build slices

<!-- Added by /slice before the first one is built. -->

## Data

Nothing new stored on the server: trends are computed from the existing entries. On the device: `nala.trendsFilters` (`localStorage`): `{ section: SectionKey, range: "7d" | "30d" | "3m" | "6m" | "birth" }`.

## UI notes

- Reused: `nala-top-app-bar`, 03's `nala-no-baby`, History's dropdown chip pattern, `.nala-scheme-<key>` on each card.
- New shared components: `nala-bar-chart` (stacked or grouped series, gaps for no-data days, lighter today bar, tap to show a value) and `nala-line-chart` (dated points, optional markers), both hand-made SVG from theme tokens, no chart library. Every bar and point has an accessible label ("Tue 7 Oct: 6 feeds").
- New in `features/trends/`: the page, `nala-trends-filter-bar`, `nala-metric-card`.
- The API image must resolve IANA time zones (check `tzdata` in the runtime image).
- Labels (EN / FR): Trends / Tendances, Range / Période, 7 days / 7 jours, 30 days / 30 jours, 3 months / 3 mois, 6 months / 6 mois, Since birth / Depuis la naissance, Previous period / Période précédente, Next period / Période suivante, Feeds / Tétées et repas, Bottle / Biberon, Breastfeeding / Allaitement, Time between feeds / Temps entre les repas, Sleep / Sommeil, Day / Jour, Night / Nuit, Longest sleep / Plus long sommeil, Diapers / Couches, Wet / Mouillée, Dirty / Sale, Pumped / Tiré, Sessions / Séances, per day / par jour, Nothing logged in this period / Rien de noté sur cette période (reused from spec 11). Growth labels reuse spec 10's.

## Out of scope

- Health trends.
- Percentiles, WHO curves, norms, targets, advice or interpretation.
- Custom date ranges (presets and period navigation only).
- Comparing with the previous period, comparing babies, charts mixing sections.
- Stats per caregiver.
- Solids beyond the feed count (foods tried: separate idea).
- A 24 h sleep pattern chart (separate idea).
- A configurable night window (fixed 19:00–07:00).
- Trends offline.

## Open questions

- None yet.
