import { DOCUMENT, Injectable, inject } from '@angular/core';
import { SectionKey } from '../../core/sections/section.models';
import { formatDate, parseDate } from '../../core/time/local-date';

/** History's time windows (spec 11): three rolling ones, then custom dates. */
export const HISTORY_WINDOWS = ['24h', '7d', '30d', 'custom'] as const;

export type HistoryWindow = (typeof HISTORY_WINDOWS)[number];

/** A rolling window, counted back from now. */
export type RollingWindow = Exclude<HistoryWindow, 'custom'>;

/** Each rolling window's length, in hours. */
export const WINDOW_HOURS: Record<RollingWindow, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

/** How many days back a custom window starts by default. */
export const CUSTOM_DEFAULT_DAYS = 90;

/** A custom window's dates: whole local days, `yyyy-MM-dd`, the start not after the end. */
export interface HistoryRange {
  start: string;
  end: string;
}

/** History's filters: the time window (with its dates when custom) and the selected sections. */
export interface HistoryFilters {
  window: HistoryWindow;
  sections: SectionKey[];
  /** Only with the custom window. */
  range?: HistoryRange;
}

/** The filters with nothing remembered: the last 24 h of Feed, Sleep and Diaper. */
export const DEFAULT_FILTERS: HistoryFilters = {
  window: '24h',
  sections: ['feed', 'sleep', 'diaper'],
};

/** The local days from `days` days before `now`'s through `now`'s. */
export function lastDays(days: number, now: Date): HistoryRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return { start: formatDate(start), end: formatDate(now) };
}

/**
 * The period the filters list, as taken `now`: a rolling window from now back, with no end; a custom
 * range from local midnight of its start to local midnight after its end (exclusive), the last 90 days
 * without one.
 */
export function historyPeriod(
  filters: HistoryFilters,
  now: Date,
): { since: Date; until: Date | null } {
  if (filters.window !== 'custom') {
    return {
      since: new Date(now.getTime() - WINDOW_HOURS[filters.window] * 3_600_000),
      until: null,
    };
  }
  const { start, end } = filters.range ?? lastDays(CUSTOM_DEFAULT_DAYS, now);
  const last = parseDate(end);
  return {
    since: parseDate(start),
    until: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
  };
}

/** A stored range, if it is two valid calendar dates in order. */
function validRange(value: unknown): HistoryRange | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { start, end } = value as Record<string, unknown>;
  const valid = (date: unknown): date is string =>
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    formatDate(parseDate(date)) === date;
  return valid(start) && valid(end) && start <= end ? { start, end } : null;
}

const STORAGE_KEY = 'nala.historyFilters';

/** History's filters chosen from the filter bar, remembered on the device (`localStorage`). */
@Injectable({ providedIn: 'root' })
export class HistoryFiltersStore {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;

  /**
   * The remembered filters among the `registered` sections: an unknown stored key is dropped; an empty
   * or unreadable selection falls back to the default sections, an unknown window to 24 h; a custom
   * window with no valid range gets the last 90 days.
   */
  read(registered: readonly SectionKey[]): HistoryFilters {
    const stored = this.parse();
    const window = HISTORY_WINDOWS.find((w) => w === stored?.['window']) ?? DEFAULT_FILTERS.window;
    const keys = Array.isArray(stored?.['sections']) ? (stored['sections'] as unknown[]) : [];
    const sections = keys.filter((key): key is SectionKey =>
      registered.includes(key as SectionKey),
    );
    const filters: HistoryFilters = {
      window,
      sections: sections.length
        ? sections
        : registered.filter((key) => DEFAULT_FILTERS.sections.includes(key)),
    };
    if (window === 'custom') {
      filters.range = validRange(stored?.['range']) ?? lastDays(CUSTOM_DEFAULT_DAYS, new Date());
    }
    return filters;
  }

  save(filters: HistoryFilters): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(filters));
  }

  private parse(): Record<string, unknown> | null {
    try {
      const value: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}
