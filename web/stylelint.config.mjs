// Component styles (src/app/**/*.scss) must only use theme tokens:
// colours are defined in the global theme under src/styles/.
/** @type {import('stylelint').Config} */
export default {
  customSyntax: 'postcss-scss',
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
      'color-mix',
    ],
  },
};
