import { DOCUMENT, Injectable, inject } from '@angular/core';
import { SectionKey } from '../../core/sections/section.models';

/** History's rolling time windows (spec 11). */
export const HISTORY_WINDOWS = ['24h', '7d', '30d'] as const;

export type HistoryWindow = (typeof HISTORY_WINDOWS)[number];

/** Each window's length, in hours. */
export const WINDOW_HOURS: Record<HistoryWindow, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

/** History's filters: the time window and the selected sections. */
export interface HistoryFilters {
  window: HistoryWindow;
  sections: SectionKey[];
}

/** The filters with nothing remembered: the last 24 h of Feed, Sleep and Diaper. */
export const DEFAULT_FILTERS: HistoryFilters = {
  window: '24h',
  sections: ['feed', 'sleep', 'diaper'],
};

const STORAGE_KEY = 'nala.historyFilters';

/** History's filters chosen from the filter bar, remembered on the device (`localStorage`). */
@Injectable({ providedIn: 'root' })
export class HistoryFiltersStore {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;

  /**
   * The remembered filters among the `registered` sections: an unknown stored key is dropped; an empty
   * or unreadable selection falls back to the default sections, an unknown window to 24 h.
   */
  read(registered: readonly SectionKey[]): HistoryFilters {
    const stored = this.parse();
    const window = HISTORY_WINDOWS.find((w) => w === stored?.['window']) ?? DEFAULT_FILTERS.window;
    const keys = Array.isArray(stored?.['sections']) ? (stored['sections'] as unknown[]) : [];
    const sections = keys.filter((key): key is SectionKey =>
      registered.includes(key as SectionKey),
    );
    return {
      window,
      sections: sections.length
        ? sections
        : registered.filter((key) => DEFAULT_FILTERS.sections.includes(key)),
    };
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
