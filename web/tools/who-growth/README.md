# WHO Child Growth Standards tables

`weianthro.txt` (weight-for-age), `lenanthro.txt` (length/height-for-age) and `hcanthro.txt`
(head-circumference-for-age) are the LMS tables of the WHO Child Growth Standards, birth to 5 years
(0–1826 days), copied unchanged from `data-raw/growthstandards/` of WHO's `anthro` R package:
https://github.com/WorldHealthOrganization/anthro (licence GPL-3, as Nala).

Columns: `sex` (1 = boy, 2 = girl), `age` (days), `l`, `m`, `s` (weight's M in kg, the others in cm);
`lenanthro.txt` adds `loh`: `L` recumbent length (up to 730 days), `H` standing height (from 731).

`node tools/who-growth.mjs` (from `web/`) generates `public/reference/who-growth.json` from them;
`tools/who-growth.test.mjs` checks the committed file is what the script produces.
