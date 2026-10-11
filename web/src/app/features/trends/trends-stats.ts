import { formatDate } from '../../core/time/local-date';
import { TrendsPeriod } from './trends-period';

/** Every local day of the period (`yyyy-MM-dd`), both ends included. */
export function periodDays(period: TrendsPeriod): string[] {
  const days: string[] = [];
  for (
    let day = new Date(period.from.getFullYear(), period.from.getMonth(), period.from.getDate());
    day.getTime() <= period.to.getTime();
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    days.push(formatDate(day));
  }
  return days;
}

/**
 * The daily average of a metric over the data days (spec 12 headlines): today, still incomplete, and
 * the days where the metric has no value are left out; null when no day is left. A zero counts.
 */
export function dailyAverage<T extends { date: string }>(
  days: readonly T[],
  value: (day: T) => number | null,
  today: string,
): number | null {
  const values = days
    .filter((day) => day.date !== today)
    .map(value)
    .filter((v): v is number => v !== null);
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}
