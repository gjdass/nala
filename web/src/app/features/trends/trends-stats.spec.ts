import { period } from './trends-period';
import { bucketBars, bucketOf, dailyAverage, firstDayOfWeek, periodDays } from './trends-stats';

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

  describe('bucketOf', () => {
    const today = new Date(2026, 9, 11);
    const days = (count: number) => ({ from: new Date(2026, 9, 12 - count), to: today });

    it('is a day up to 31 days', () => {
      expect(bucketOf(period('7d', 0, today, ''))).toBe('day');
      expect(bucketOf(period('30d', 0, today, ''))).toBe('day');
      expect(bucketOf(days(31))).toBe('day');
    });

    it('is a week up to 6 months', () => {
      expect(bucketOf(days(32))).toBe('week');
      expect(bucketOf(period('3m', 0, today, ''))).toBe('week');
      expect(bucketOf(period('6m', 0, today, ''))).toBe('week');
    });

    it('is a month beyond 6 months', () => {
      expect(bucketOf({ from: new Date(2026, 3, 11), to: today })).toBe('month');
    });
  });

  describe('firstDayOfWeek', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('follows the locale: Monday in French, Sunday in English', () => {
      expect(firstDayOfWeek('fr')).toBe(1);
      expect(firstDayOfWeek('en')).toBe(7);
    });

    it('falls back without week info in the browser', () => {
      vi.stubGlobal('Intl', Object.create(Intl, { Locale: { value: class {} } }));

      expect(firstDayOfWeek('fr')).toBe(1);
      expect(firstDayOfWeek('en')).toBe(7);
    });
  });

  describe('bucketBars', () => {
    interface Day {
      date: string;
      v: number[] | null;
    }
    const values = (d: Day) => d.v;
    const today = '2026-10-11';
    // Wed 23 Sep to Sun 11 Oct (today).
    const weeks = { from: new Date(2026, 8, 23), to: new Date(2026, 9, 11) };
    const data: Day[] = [
      { date: '2026-09-23', v: [2, 1] },
      { date: '2026-09-24', v: [4, 3] },
      { date: '2026-09-28', v: [0, 0] },
      { date: '2026-09-30', v: null },
      { date: '2026-10-01', v: [6, 4] },
      { date: '2026-10-11', v: [10, 10] },
    ];

    it('gives a slot per day, today partial, none without data', () => {
      const period = { from: new Date(2026, 9, 9), to: new Date(2026, 9, 11) };
      const days: Day[] = [
        { date: '2026-10-09', v: [1] },
        { date: '2026-10-11', v: [2] },
      ];

      expect(bucketBars(period, days, values, today, 'day', 1)).toEqual([
        { date: '2026-10-09', values: [1], partial: false },
        { date: '2026-10-10', values: null, partial: false },
        { date: '2026-10-11', values: [2], partial: true },
      ]);
    });

    it('averages each week from Monday over its data days, without today', () => {
      expect(bucketBars(weeks, data, values, today, 'week', 1)).toEqual([
        { date: '2026-09-21', values: [3, 2] },
        { date: '2026-09-28', values: [3, 2] },
        { date: '2026-10-05', values: null },
      ]);
    });

    it('starts the weeks on Sunday when the locale does', () => {
      expect(bucketBars(weeks, data, values, today, 'week', 7)).toEqual([
        { date: '2026-09-20', values: [3, 2] },
        { date: '2026-09-27', values: [3, 2] },
        { date: '2026-10-04', values: null },
        { date: '2026-10-11', values: null },
      ]);
    });

    it('averages each calendar month over its data days, without today', () => {
      const months = { from: new Date(2026, 6, 15), to: new Date(2026, 9, 11) };
      const days: Day[] = [
        { date: '2026-07-20', v: [4] },
        { date: '2026-08-01', v: [2] },
        { date: '2026-08-02', v: [4] },
        { date: '2026-10-11', v: [9] },
      ];

      expect(bucketBars(months, days, values, today, 'month', 1)).toEqual([
        { date: '2026-07-01', values: [4] },
        { date: '2026-08-01', values: [3] },
        { date: '2026-09-01', values: null },
        { date: '2026-10-01', values: null },
      ]);
    });
  });
});
