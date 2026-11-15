// Generates public/reference/who-growth.json (spec 12, Growth percentiles) from the WHO Child Growth
// Standards tables committed in tools/who-growth/ (see its README). Run from web/:
//   node tools/who-growth.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TABLES = { weight: 'weianthro.txt', length: 'lenanthro.txt', head: 'hcanthro.txt' };
const SEXES = { 1: 'boy', 2: 'girl' };
const tablesDir = fileURLToPath(new URL('./who-growth/', import.meta.url));
const output = fileURLToPath(new URL('../public/reference/who-growth.json', import.meta.url));

/** Every day up to 14, then every 7th day, plus 730 and 731 (length becomes height) and the last day. */
const kept = (age, last) =>
  age <= 14 || age % 7 === 0 || age === 730 || age === 731 || age === last;

function readTable(file) {
  const [header, ...lines] = readFileSync(tablesDir + file, 'utf8')
    .trim()
    .split(/\r?\n/);
  const columns = header.split('\t');
  return lines.map((line) => {
    const cells = line.split('\t');
    const row = Object.fromEntries(columns.map((c, i) => [c, cells[i]]));
    return {
      sex: SEXES[row.sex],
      age: Number(row.age),
      l: Number(row.l),
      m: Number(row.m),
      s: Number(row.s),
    };
  });
}

export function buildReference() {
  const tables = Object.fromEntries(Object.entries(TABLES).map(([k, f]) => [k, readTable(f)]));
  const last = Math.max(...tables.weight.map((r) => r.age));
  const ageDays = [...new Set(tables.weight.map((r) => r.age))]
    .filter((age) => kept(age, last))
    .sort((a, b) => a - b);
  const reference = {
    source:
      'WHO Child Growth Standards (weight, length/height and head circumference for age), ' +
      "from WHO's anthro R package, data-raw/growthstandards (github.com/WorldHealthOrganization/anthro)",
    licence: 'GPL-3',
    ageDays,
  };
  for (const sex of ['girl', 'boy']) {
    reference[sex] = {};
    for (const [measure, rows] of Object.entries(tables)) {
      const byAge = new Map(rows.filter((r) => r.sex === sex).map((r) => [r.age, r]));
      const pick = (key) =>
        ageDays.map((age) => {
          const row = byAge.get(age);
          if (!row) throw new Error(`${TABLES[measure]}: no ${sex} row for day ${age}`);
          return row[key];
        });
      reference[sex][measure] = { l: pick('l'), m: pick('m'), s: pick('s') };
    }
  }
  return reference;
}

export const serialize = (reference) => JSON.stringify(reference) + '\n';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(output, serialize(buildReference()));
  console.log(`Wrote ${output}`);
}
