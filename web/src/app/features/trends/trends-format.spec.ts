import { formatCount, formatMl } from './trends-format';

describe('trends formats', () => {
  it('shows counts whole, and their averages with one decimal, in the language', () => {
    expect(formatCount(6, 'en')).toBe('6');
    expect(formatCount(6.43, 'en')).toBe('6.4');
    expect(formatCount(6.43, 'fr')).toBe('6,4');
    expect(formatCount(6.96, 'en')).toBe('7');
  });

  it('shows ml rounded to whole numbers', () => {
    expect(formatMl(719.6, 'en')).toBe('720 ml');
    expect(formatMl(1250, 'en')).toBe('1,250 ml');
    expect(formatMl(0, 'fr')).toBe('0 ml');
  });
});
