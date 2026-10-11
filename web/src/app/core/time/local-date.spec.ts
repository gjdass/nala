import { formatDate } from './local-date';

describe('formatDate', () => {
  it('gives the local day as yyyy-MM-dd', () => {
    expect(formatDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 9, 11, 0, 0))).toBe('2026-10-11');
  });
});
