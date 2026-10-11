import { Milestone } from '../growth-entries/growth-entry.models';

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

/**
 * A data day of Diaper trends (spec 12), on the local day of each diaper: wet and dirty diapers (a wet
 * and dirty one counts in both) and every diaper, dry ones included.
 */
export interface DiaperTrendDay {
  date: string;
  wet: number;
  dirty: number;
  count: number;
}

/**
 * A data day of Pump trends (spec 12), on the local day each session starts: ml per side (a side not
 * recorded counts 0) and the sessions.
 */
export interface PumpTrendDay {
  date: string;
  leftMl: number;
  rightMl: number;
  sessions: number;
}

/**
 * A data day of Feed trends (spec 12): feeds by kind and bottle ml by milk type on the day each feed
 * starts, breastfeeding seconds per side split across days, and the gaps between feeds (start to start,
 * up to 8 hours) on the later feed's day.
 */
export interface FeedTrendDay {
  date: string;
  count: { breastfeed: number; bottle: number; solids: number };
  bottleMl: { breastMilk: number; formula: number };
  breastSeconds: { left: number; right: number };
  gapSecondsSum: number;
  gapCount: number;
}

/**
 * A point of the growth curves (spec 12): a measurement's values, or the baby's birth measurements
 * (`birth`), dated with the birth date. Each value is null when not measured.
 */
export interface GrowthTrendPoint {
  date: string;
  weightG: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
  birth: boolean;
}

/** A milestone of the weight curve; `title` only for a custom one. */
export interface GrowthTrendMilestone {
  date: string;
  milestone: Milestone;
  title: string | null;
}

/** The measurements and milestones dated in a period, in date order, the birth point first. */
export interface GrowthTrends {
  measurements: GrowthTrendPoint[];
  milestones: GrowthTrendMilestone[];
}
