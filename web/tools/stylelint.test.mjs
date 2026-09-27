import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const configFile = fileURLToPath(new URL('../stylelint.config.mjs', import.meta.url));
const cwd = fileURLToPath(new URL('..', import.meta.url));

async function errorsFor(code) {
  const { results } = await stylelint.lint({ code, configFile, codeFilename: 'sample.scss' });
  return results[0].warnings.filter((w) => w.severity === 'error');
}

describe('colour lint (component styles)', () => {
  it('rejects hex colours', async () => {
    assert.notEqual((await errorsFor('a { color: #fff; }')).length, 0);
  });

  it('rejects named colours', async () => {
    assert.notEqual((await errorsFor('a { color: red; }')).length, 0);
  });

  for (const fn of ['rgb(0 0 0)', 'rgba(0, 0, 0, 0.5)', 'hsl(0 0% 0%)', 'oklch(0.5 0.1 20)']) {
    it(`rejects ${fn}`, async () => {
      assert.notEqual((await errorsFor(`a { background: ${fn}; }`)).length, 0);
    });
  }

  it('accepts theme tokens', async () => {
    const errors = await errorsFor(
      'a { color: var(--mat-sys-primary); background: var(--nala-section-feed); }',
    );
    assert.deepEqual(errors, []);
  });

  it('lints component styles under src/app', async () => {
    const { errored, results } = await stylelint.lint({
      files: 'src/app/**/*.scss',
      configFile,
      cwd,
      allowEmptyInput: true,
    });
    assert.equal(errored, false, JSON.stringify(results.flatMap((r) => r.warnings)));
  });
});
