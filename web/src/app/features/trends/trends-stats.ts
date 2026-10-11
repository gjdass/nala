import { formatDate, parseDate } from '../../core/time/local-date';
import { BarBucket, BarDatum } from '../../shared/ui/bar-chart/bar-chart.component';
import { TrendsPeriod, addDays, addMonths } from './trends-period';

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

/** Up to 31 days: a bar per day; up to 6 months: per week; longer: per month. */
export function bucketOf(period: TrendsPeriod): BarBucket {
  if (addDays(period.from, 30).getTime() >= period.to.getTime()) {
    return 'day';
  }
  return period.from.getTime() >= addDays(addMonths(period.to, -6), 1).getTime() ? 'week' : 'month';
}

type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/** The locale's first day of the week, 1 (Monday) to 7 (Sunday); Sunday in English without week info. */
export function firstDayOfWeek(lang: string): number {
  const locale = new Intl.Locale(lang) as WeekInfoLocale;
  const info = locale.getWeekInfo?.() ?? locale.weekInfo;
  return info?.firstDay ?? (lang.split('-')[0] === 'en' ? 7 : 1);
}

/** The first day of the week or month holding `date`. */
function bucketStart(date: Date, bucket: 'week' | 'month', firstDay: number): Date {
  if (bucket === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  const weekday = date.getDay() || 7;
  return addDays(date, -((weekday - firstDay + 7) % 7));
}

/**
 * The bars of a chart: a slot per day of the period (today partial), or per week (from the locale's
 * `firstDay`) or calendar month, keyed by its first day. A week or month bar is the daily average of
 * each series over its data days in the period, today and the days without a value left out; no bar
 * when none is left.
 */
export function bucketBars<T extends { date: string }>(
  period: TrendsPeriod,
  days: readonly T[],
  values: (day: T) => readonly number[] | null,
  today: string,
  bucket: BarBucket,
  firstDay: number,
): BarDatum[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  if (bucket === 'day') {
    return periodDays(period).map((date) => {
      const day = byDate.get(date);
      return { date, values: day ? values(day) : null, partial: date === today };
    });
  }
  const buckets = new Map<string, (readonly number[])[]>();
  for (const date of periodDays(period)) {
    const key = formatDate(bucketStart(parseDate(date), bucket, firstDay));
    const bucketValues = buckets.get(key) ?? [];
    buckets.set(key, bucketValues);
    const day = byDate.get(date);
    const value = day && date !== today ? values(day) : null;
    if (value) {
      bucketValues.push(value);
    }
  }
  return [...buckets].map(([date, list]) => ({
    date,
    values: list.length
      ? list[0].map((_, series) => list.reduce((sum, v) => sum + v[series], 0) / list.length)
      : null,
  }));
}
