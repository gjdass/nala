import { DOCUMENT, Injectable, inject } from '@angular/core';
import { TRENDS_RANGES, TrendsRange } from './trends-period';

/** The sections that have trends, in the default order. Health has none. */
export const TRENDS_SECTIONS = ['feed', 'sleep', 'diaper', 'pump', 'growth'] as const;

export type TrendsSection = (typeof TRENDS_SECTIONS)[number];

/**
 * Trends' filters; a null section means the default one (from the home order). `percentiles` shows
 * the WHO percentile bands on Growth's charts.
 */
export interface TrendsFilters {
  section: TrendsSection | null;
  range: TrendsRange;
  percentiles: boolean;
}

const STORAGE_KEY = 'nala.trendsFilters';

/** Trends' section, range and percentiles, remembered on the device (`localStorage`); not the period offset. */
@Injectable({ providedIn: 'root' })
export class TrendsFiltersStore {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;

  /**
   * An unknown or ineligible section falls back to the default (null), an unknown range to 7 days, a
   * missing or non-boolean percentiles to on.
   */
  read(): TrendsFilters {
    const stored = this.parse();
    return {
      section: TRENDS_SECTIONS.find((s) => s === stored?.['section']) ?? null,
      range: TRENDS_RANGES.find((r) => r === stored?.['range']) ?? '7d',
      percentiles: typeof stored?.['percentiles'] === 'boolean' ? stored['percentiles'] : true,
    };
  }

  save(filters: TrendsFilters): void {
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
