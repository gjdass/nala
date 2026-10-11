/** A period of whole local days, both ends included, as local midnights. */
export interface TrendsPeriod {
  from: Date;
  to: Date;
}

/**
 * A data day of Sleep trends (spec 12): seconds slept by day and by night (19:00–07:00 local), and the
 * longest sleep starting that day, null when none starts on it.
 */
export interface SleepTrendDay {
  date: string;
  daySeconds: number;
  nightSeconds: number;
  longestSeconds: number | null;
}
