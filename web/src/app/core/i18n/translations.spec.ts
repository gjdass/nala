import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';

type Tree = Record<string, unknown>;

function entries(tree: Tree, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? entries(value as Tree, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

const keys = (tree: Tree) =>
  entries(tree)
    .map(([key]) => key)
    .sort();

describe('translations', () => {
  it('en and fr define the same keys', () => {
    expect(keys(fr)).toEqual(keys(en));
  });

  it('no translation value is empty', () => {
    for (const [lang, tree] of Object.entries({ en, fr })) {
      const empty = entries(tree).filter(
        ([, value]) => typeof value !== 'string' || value.trim() === '',
      );
      expect(empty, lang).toEqual([]);
    }
  });
});
