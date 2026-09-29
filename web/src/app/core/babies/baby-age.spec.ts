import { BabyAge, babyAge } from './baby-age';

describe('babyAge', () => {
  /** A local date, as the device sees today. */
  const on = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 15, 30);
  };
  const age = (birthDate: string, today: string) => babyAge(birthDate, on(today));
  const of = (months: number, weeks: number, days: number): BabyAge => ({ months, weeks, days });

  it('counts days for the first 2 weeks', () => {
    expect(age('2026-09-01', '2026-09-01')).toEqual(of(0, 0, 0));
    expect(age('2026-09-01', '2026-09-06')).toEqual(of(0, 0, 5));
    expect(age('2026-09-01', '2026-09-14')).toEqual(of(0, 0, 13));
  });

  it('counts weeks and days from 2 weeks until 3 months', () => {
    expect(age('2026-09-01', '2026-09-15')).toEqual(of(0, 2, 0));
    expect(age('2026-06-01', '2026-07-15')).toEqual(of(0, 6, 2));
    // The last day before 3 months: 91 days.
    expect(age('2026-06-01', '2026-08-31')).toEqual(of(0, 13, 0));
  });

  it('counts months and days from 3 months', () => {
    expect(age('2026-06-01', '2026-09-01')).toEqual(of(3, 0, 0));
    expect(age('2026-05-18', '2026-09-28')).toEqual(of(4, 0, 10));
    expect(age('2025-07-25', '2026-09-28')).toEqual(of(14, 0, 3));
  });

  it('puts a monthly anniversary on the last day of a shorter month', () => {
    expect(age('2025-11-30', '2026-02-27')).toEqual(of(0, 12, 5));
    expect(age('2025-11-30', '2026-02-28')).toEqual(of(3, 0, 0));
    expect(age('2026-01-31', '2026-04-30')).toEqual(of(3, 0, 0));
    expect(age('2026-01-31', '2026-05-01')).toEqual(of(3, 0, 1));
  });

  it('handles a leap-day birth', () => {
    expect(age('2024-02-29', '2025-02-27')).toEqual(of(11, 0, 29));
    expect(age('2024-02-29', '2025-02-28')).toEqual(of(12, 0, 0));
  });

  it('is not thrown off by a daylight saving change', () => {
    // Europe and North America change clocks in late March.
    expect(age('2026-03-20', '2026-04-03')).toEqual(of(0, 2, 0));
  });
});
