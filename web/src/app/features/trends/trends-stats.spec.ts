import { dailyAverage, periodDays } from './trends-stats';

describe('trends stats', () => {
  describe('periodDays', () => {
    it('lists every local day of the period, both ends included', () => {
      expect(periodDays({ from: new Date(2026, 8, 29), to: new Date(2026, 9, 2) })).toEqual([
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
      ]);
    });

    it('counts a clock change day once', () => {
      const days = periodDays({ from: new Date(2026, 2, 7), to: new Date(2026, 2, 10) });

      expect(days).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
    });
  });

  describe('dailyAverage', () => {
    const days = [
      { date: '2026-10-06', value: 0 as number | null },
      { date: '2026-10-07', value: 6 },
      { date: '2026-10-08', value: null },
      { date: '2026-10-09', value: 30 },
    ];

    it('averages the data days, zero ones included, without today nor days with no value', () => {
      expect(dailyAverage(days, (d) => d.value, '2026-10-09')).toBe(3);
    });

    it('is null when no day is left', () => {
      expect(dailyAverage([days[3]], (d) => d.value, '2026-10-09')).toBeNull();
      expect(dailyAverage(days.slice(0, 0), (d) => d.value, '2026-10-09')).toBeNull();
    });
  });
});
