import { parseDate } from '../../core/time/local-date';
import { TrendsPeriod } from '../../core/trends/trends.models';

/** The ranges Trends offers (spec 12). */
export const TRENDS_RANGES = ['7d', '30d', '3m', '6m', 'birth'] as const;

export type TrendsRange = (typeof TRENDS_RANGES)[number];

export type { TrendsPeriod };

const DAYS: Partial<Record<TrendsRange, number>> = { '7d': 7, '30d': 30 };
const MONTHS: Partial<Record<TrendsRange, number>> = { '3m': 3, '6m': 6 };

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Adds months, clamping a day missing in the target month to its last day. */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

/**
 * The period of a range: `offset` 0 is the current one ending `today`, -1 the one of the same length
 * just before, and so on. Since birth runs from the `birthDate` (today without one) and ignores the
 * offset.
 */
export function period(
  range: TrendsRange,
  offset: number,
  today: Date,
  birthDate: string,
): TrendsPeriod {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = DAYS[range];
  if (days) {
    const to = addDays(day, days * offset);
    return { from: addDays(to, -(days - 1)), to };
  }
  const months = MONTHS[range];
  if (months) {
    // Both ends count from today, so a day clamped in a short month never makes two periods overlap.
    return {
      from: addDays(addMonths(day, months * (offset - 1)), 1),
      to: addMonths(day, months * offset),
    };
  }
  return { from: birthDate ? parseDate(birthDate) : day, to: day };
}

/** Nothing goes before the birth date: no earlier period once this one reaches it. */
export function canGoBack(current: TrendsPeriod, birthDate: string): boolean {
  return current.from.getTime() > parseDate(birthDate).getTime();
}

export function canGoForward(offset: number): boolean {
  return offset < 0;
}

/** The period's dates: days ("Oct 3 – 9") for day ranges, months ("Jul – Oct 2026") for the others. */
export function periodLabel(
  current: TrendsPeriod,
  range: TrendsRange,
  lang: string,
  today: Date,
): string {
  const options: Intl.DateTimeFormatOptions = DAYS[range]
    ? {
        month: 'short',
        day: 'numeric',
        ...(current.from.getFullYear() !== today.getFullYear() ||
        current.to.getFullYear() !== today.getFullYear()
          ? { year: 'numeric' }
          : {}),
      }
    : { month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(lang, options).formatRange(current.from, current.to);
}
