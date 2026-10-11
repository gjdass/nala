import { TrendsRange, canGoBack, canGoForward, period, periodLabel } from './trends-period';

describe('trends periods', () => {
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const bounds = (range: TrendsRange, offset: number, today: Date, birth = '2020-01-01') => {
    const p = period(range, offset, today, birth);
    return [iso(p.from), iso(p.to)];
  };
  const today = day(2026, 10, 9);

  it('7 days run from today minus 6 days to today, 30 days minus 29', () => {
    expect(bounds('7d', 0, today)).toEqual(['2026-10-03', '2026-10-09']);
    expect(bounds('30d', 0, today)).toEqual(['2026-09-10', '2026-10-09']);
  });

  it('3 and 6 months run from the same day that many months ago plus 1 day', () => {
    expect(bounds('3m', 0, today)).toEqual(['2026-07-10', '2026-10-09']);
    expect(bounds('6m', 0, today)).toEqual(['2026-04-10', '2026-10-09']);
  });

  it('clamps a day missing in the target month', () => {
    expect(bounds('3m', 0, day(2024, 5, 31))).toEqual(['2024-03-01', '2024-05-31']);
  });

  it('since birth runs from the birth date to today', () => {
    expect(bounds('birth', 0, today, '2026-09-01')).toEqual(['2026-09-01', '2026-10-09']);
  });

  it('steps back by whole periods', () => {
    expect(bounds('7d', -1, today)).toEqual(['2026-09-26', '2026-10-02']);
    expect(bounds('7d', -2, today)).toEqual(['2026-09-19', '2026-09-25']);
    expect(bounds('3m', -1, today)).toEqual(['2026-04-10', '2026-07-09']);
    expect(bounds('6m', -1, today)).toEqual(['2025-10-10', '2026-04-09']);
  });

  it("can't go back once the period reaches the birth date, nor forward on the current period", () => {
    expect(canGoBack(period('7d', 0, today, '2026-09-01'), '2026-09-01')).toBe(true);
    expect(canGoBack(period('7d', -1, today, '2026-09-26'), '2026-09-26')).toBe(false);
    expect(canGoBack(period('7d', -1, today, '2026-09-30'), '2026-09-30')).toBe(false);
    expect(canGoForward(0)).toBe(false);
    expect(canGoForward(-1)).toBe(true);
  });

  describe('label', () => {
    const norm = (s: string) => s.replace(/\s+/g, ' ');
    const label = (
      range: TrendsRange,
      offset: number,
      lang: string,
      t = today,
      birth = '2020-01-01',
    ) => norm(periodLabel(period(range, offset, t, birth), range, lang, t));

    it('gives day ranges as dates, in the app language', () => {
      expect(label('7d', 0, 'en')).toBe('Oct 3 – 9');
      expect(label('7d', 0, 'en', day(2026, 10, 3))).toBe('Sep 27 – Oct 3');
      expect(label('7d', 0, 'fr')).toMatch(/^3\s?[–-]\s?9 oct\.$/);
    });

    it('adds the year when the period is not in the current year', () => {
      expect(label('7d', 0, 'en', day(2026, 1, 3))).toBe('Dec 28, 2025 – Jan 3, 2026');
      expect(label('30d', -3, 'en')).toContain('Jul');
      expect(label('7d', -60, 'en', day(2026, 10, 9))).toContain('2025');
    });

    it('gives month ranges as months and year', () => {
      expect(label('3m', 0, 'en')).toBe('Jul – Oct 2026');
      expect(label('6m', 0, 'en')).toBe('Apr – Oct 2026');
      expect(label('birth', 0, 'en', today, '2025-08-15')).toBe('Aug 2025 – Oct 2026');
    });
  });
});
