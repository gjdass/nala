/**
 * A baby's age, in one of three shapes: `days` only for the first 2 weeks, `weeks` + `days` until
 * 3 months, then `months` + `days`. The unused parts are 0.
 */
export interface BabyAge {
  months: number;
  weeks: number;
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar dates as UTC midnights, so daylight saving changes don't shift day counts. */
function utcDay(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day);
}

/** The `months`-th monthly anniversary, on the month's last day when it is shorter. */
function anniversary(year: number, monthIndex: number, day: number, months: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex + months + 1, 0)).getUTCDate();
  return utcDay(year, monthIndex + months, Math.min(day, lastDay));
}

/** Age from a `yyyy-MM-dd` birth date to the local calendar day of `today`. */
export function babyAge(birthDate: string, today: Date): BabyAge {
  const [year, month, day] = birthDate.split('-').map(Number);
  const monthIndex = month - 1;
  const now = utcDay(today.getFullYear(), today.getMonth(), today.getDate());

  let months = (today.getFullYear() - year) * 12 + today.getMonth() - monthIndex;
  if (anniversary(year, monthIndex, day, months) > now) {
    months--;
  }

  if (months >= 3) {
    const since = anniversary(year, monthIndex, day, months);
    return { months, weeks: 0, days: Math.round((now - since) / DAY_MS) };
  }
  const days = Math.round((now - utcDay(year, monthIndex, day)) / DAY_MS);
  return days < 14
    ? { months: 0, weeks: 0, days }
    : { months: 0, weeks: Math.floor(days / 7), days: days % 7 };
}
