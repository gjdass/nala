import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const SECTIONS = ['feed', 'sleep', 'diaper', 'pump', 'growth', 'health'];
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

  it('takes its colours from the app icon: orange primary, grass-green tertiary', () => {
    const hue = (token) => {
      const hex = css.match(new RegExp(`--mat-sys-${token}:\\s*light-dark\\(#([0-9a-f]{6})`, 'i'))[1];
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const primary = hue('primary');
    assert.ok(primary >= 15 && primary <= 45, `primary hue ${primary} is orange`);
    const tertiary = hue('tertiary');
    assert.ok(tertiary >= 90 && tertiary <= 160, `tertiary hue ${tertiary} is green`);
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

  it('defines a dot colour token for every stool colour of a dirty diaper (spec 07)', () => {
    for (const color of ['yellow', 'green', 'brown', 'black', 'red', 'white']) {
      assert.match(css, new RegExp(`--nala-stool-${color}:\\s*#[0-9a-fA-F]{3,8}`), color);
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

  it('defines the top safe-area offset: the inset plus 8 px, nothing without an inset (spec 04)', () => {
    assert.match(
      css,
      /--nala-safe-top:\s*calc\(env\(safe-area-inset-top\) \+ min\(env\(safe-area-inset-top\), 8px\)\)/,
    );
  });

  it('starts every screen below the top safe area', () => {
    assert.match(css, /body\s*\{[^}]*padding-top:\s*var\(--nala-safe-top\)/);
  });

  it('makes the top offset at least 12 px on iOS, so the edge guard is tall enough for iOS to take it', () => {
    assert.match(
      css,
      /@supports \(-webkit-touch-callout: none\)\s*\{\s*html\s*\{[^}]*--nala-safe-top:\s*max\(calc\(env\(safe-area-inset-top\) \+ min\(env\(safe-area-inset-top\), 8px\)\), 12px\)/,
    );
  });

  it('pins a solid edge guard across the top edge, as tall as the top offset, so iOS 26 tints it instead of blurring', () => {
    const rule = css.match(/\.nala-edge-guard\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(rule, /position:\s*fixed/);
    assert.match(rule, /top:\s*0/);
    assert.match(rule, /inset-inline:\s*0/);
    assert.match(rule, /height:\s*var\(--nala-safe-top\)/);
    assert.match(rule, /background:\s*var\(--mat-sys-surface\)/);
  });

  it("never rubber-bands the document, so the bottom navigation bar can't be dragged", () => {
    assert.match(css, /html,\s*body\s*\{[^}]*overscroll-behavior-y:\s*none/);
  });

  it('ends the bottom sheets above the bottom safe area', () => {
    assert.match(
      css,
      /\.mat-bottom-sheet-container\s*\{[^}]*padding:\s*0 0 env\(safe-area-inset-bottom\)/,
    );
  });

  it("keeps Material's default density, so controls keep their 48 dp touch targets", () => {
    assert.doesNotMatch(css, /density/);
    assert.doesNotMatch(css, /touch-target-(display|size)/);
  });
});
