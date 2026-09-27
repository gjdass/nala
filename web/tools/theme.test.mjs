import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const SECTIONS = ['feed', 'sleep', 'diaper', 'pump', 'growth', 'medication'];
const entry = fileURLToPath(new URL('../src/styles/styles.scss', import.meta.url));
const nodeModules = fileURLToPath(new URL('../node_modules', import.meta.url));

describe('global theme', () => {
  let css;

  before(() => {
    css = sass.compile(entry, { loadPaths: [nodeModules] }).css;
  });

  it('defines the Material 3 system tokens', () => {
    assert.match(css, /--mat-sys-primary:\s*light-dark\(/);
  });

  it('follows the system colour scheme by default', () => {
    assert.match(css, /html\s*\{[^}]*color-scheme:\s*light dark/);
  });

  it('defines a colour and an on-colour token for every section, light and dark', () => {
    for (const key of SECTIONS) {
      assert.match(css, new RegExp(`--nala-section-${key}:\\s*light-dark\\(`), key);
      assert.match(css, new RegExp(`--nala-on-section-${key}:\\s*light-dark\\(`), `on-${key}`);
    }
  });
});
