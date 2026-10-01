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

  it('defines a container and an on-container token for every section, light and dark', () => {
    for (const key of SECTIONS) {
      assert.match(css, new RegExp(`--nala-section-${key}-container:\\s*light-dark\\(`), key);
      assert.match(
        css,
        new RegExp(`--nala-on-section-${key}-container:\\s*light-dark\\(`),
        `on-${key}`,
      );
    }
  });

  it('colours the section card small FAB and text button from the section tokens', () => {
    const block = (selector) => css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const fab = block('.nala-section-fab');
    assert.match(fab, /--mat-fab-small-container-color:\s*var\(--nala-section-container\)/);
    assert.match(fab, /--mat-fab-small-foreground-color:\s*var\(--nala-on-section-container\)/);
    const text = block('.nala-section-text-button');
    assert.match(text, /--mat-button-text-label-text-color:\s*var\(--nala-section-accent\)/);
  });

  it('defines a translucent surface token for the floating bottom navigation bar, from the theme surface', () => {
    assert.match(css, /--nala-nav-bar-surface:\s*color-mix\([^;]*var\(--mat-sys-surface-container\)[^;]*transparent\)/);
  });

  it("keeps Material's default density, so controls keep their 48 dp touch targets", () => {
    assert.doesNotMatch(css, /density/);
    assert.doesNotMatch(css, /touch-target-(display|size)/);
  });
});
