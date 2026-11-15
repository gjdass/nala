import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildReference, serialize } from './who-growth.mjs';

const published = fileURLToPath(new URL('../public/reference/who-growth.json', import.meta.url));
const ngsw = JSON.parse(readFileSync(new URL('../ngsw-config.json', import.meta.url), 'utf8'));

describe('WHO growth reference', () => {
  it('is the committed file the script produces from the WHO tables', () => {
    assert.equal(readFileSync(published, 'utf8'), serialize(buildReference()));
  });

  it('keeps every day up to 14, then every 7th day, plus 730, 731 and the last day, 1826', () => {
    const { ageDays } = buildReference();
    assert.deepEqual(
      ageDays.slice(0, 17),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 28],
    );
    assert.ok(ageDays.includes(730) && ageDays.includes(731));
    assert.equal(ageDays.at(-1), 1826);
    assert.deepEqual(
      [...ageDays].sort((a, b) => a - b),
      ageDays,
    );
    assert.equal(new Set(ageDays).size, ageDays.length);
  });

  it('holds L, M and S per sex and measure, aligned with the ages, from the WHO rows', () => {
    const reference = buildReference();
    for (const sex of ['girl', 'boy']) {
      for (const measure of ['weight', 'length', 'head']) {
        for (const key of ['l', 'm', 's']) {
          assert.equal(reference[sex][measure][key].length, reference.ageDays.length);
        }
      }
    }
    assert.deepEqual(
      ['l', 'm', 's'].map((k) => reference.boy.weight[k][0]),
      [0.3487, 3.3464, 0.14602],
    );
    const at731 = reference.ageDays.indexOf(731);
    assert.equal(reference.boy.length.m[at731], 87.1303);
    assert.match(reference.source, /WHO/);
    assert.match(reference.licence, /GPL-3/);
  });

  it("is in the service worker's lazy assets", () => {
    const lazy = ngsw.assetGroups.find((g) => g.installMode === 'lazy');
    assert.ok(lazy.resources.files.includes('/reference/*.json'));
  });
});
