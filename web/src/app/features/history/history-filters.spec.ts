import { TestBed } from '@angular/core/testing';
import { SECTION_KEYS } from '../../core/sections/section.models';
import { DEFAULT_FILTERS, HistoryFiltersStore, historyPeriod, lastDays } from './history-filters';

describe('HistoryFiltersStore', () => {
  const KEY = 'nala.historyFilters';
  let store: HistoryFiltersStore;

  beforeEach(() => {
    localStorage.clear();
    store = TestBed.inject(HistoryFiltersStore);
  });

  it('gives the default with nothing stored: 24 h, Feed, Sleep and Diaper', () => {
    expect(store.read(SECTION_KEYS)).toEqual({
      window: '24h',
      sections: ['feed', 'sleep', 'diaper'],
    });
    expect(DEFAULT_FILTERS).toEqual({ window: '24h', sections: ['feed', 'sleep', 'diaper'] });
  });

  it('reads back what was saved', () => {
    store.save({ window: '7d', sections: ['pump', 'feed'] });

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      window: '7d',
      sections: ['pump', 'feed'],
    });
    expect(store.read(SECTION_KEYS)).toEqual({ window: '7d', sections: ['pump', 'feed'] });
  });

  it('drops a stored key that is no longer registered', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ window: '30d', sections: ['pump', 'growth', 'bath'] }),
    );

    expect(store.read(['feed', 'sleep', 'pump'])).toEqual({ window: '30d', sections: ['pump'] });
  });

  it('falls back to the default sections when the stored selection is left empty', () => {
    localStorage.setItem(KEY, JSON.stringify({ window: '7d', sections: ['bath'] }));

    expect(store.read(SECTION_KEYS)).toEqual({
      window: '7d',
      sections: ['feed', 'sleep', 'diaper'],
    });
  });

  it('keeps only the registered default sections', () => {
    expect(store.read(['sleep', 'pump'])).toEqual({ window: '24h', sections: ['sleep'] });
  });

  it('falls back to the default when the stored value is unreadable', () => {
    for (const value of [
      '{nope',
      '"7d"',
      'null',
      JSON.stringify({ window: '7d', sections: 'feed' }),
    ]) {
      localStorage.setItem(KEY, value);
      expect(store.read(SECTION_KEYS).sections).toEqual(['feed', 'sleep', 'diaper']);
    }
    localStorage.setItem(KEY, '{nope');
    expect(store.read(SECTION_KEYS)).toEqual(DEFAULT_FILTERS);
  });

  it('falls back to 24 h for an unknown window', () => {
    localStorage.setItem(KEY, JSON.stringify({ window: '1y', sections: ['pump'] }));

    expect(store.read(SECTION_KEYS)).toEqual({ window: '24h', sections: ['pump'] });
  });

  it('reads back a custom window with its dates', () => {
    const saved = {
      window: 'custom' as const,
      sections: ['feed' as const],
      range: { start: '2026-01-05', end: '2026-02-10' },
    };
    store.save(saved);

    expect(store.read(SECTION_KEYS)).toEqual(saved);
  });

  it('gives a custom window with a missing, unreadable or reversed range the last 90 days', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 2, 9, 30));
    try {
      for (const range of [
        undefined,
        'nope',
        { start: '2026-13-45', end: '2026-02-01' },
        { start: '2026-03-01', end: '2026-02-01' },
        { start: 20260101, end: '2026-02-01' },
      ]) {
        localStorage.setItem(KEY, JSON.stringify({ window: 'custom', sections: ['feed'], range }));
        expect(store.read(SECTION_KEYS)).toEqual({
          window: 'custom',
          sections: ['feed'],
          range: { start: '2026-08-04', end: '2026-11-02' },
        });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a stored range with a rolling window', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        window: '7d',
        sections: ['feed'],
        range: { start: '2026-01-01', end: '2026-01-02' },
      }),
    );

    expect(store.read(SECTION_KEYS)).toEqual({ window: '7d', sections: ['feed'] });
  });

  it('leaves a section registered later unselected', () => {
    localStorage.setItem(KEY, JSON.stringify({ window: '24h', sections: ['feed'] }));

    expect(store.read([...SECTION_KEYS]).sections).toEqual(['feed']);
  });
});

describe('lastDays', () => {
  it('gives today − n days through today as local dates', () => {
    expect(lastDays(90, new Date(2026, 10, 2, 23, 59))).toEqual({
      start: '2026-08-04',
      end: '2026-11-02',
    });
    expect(lastDays(1, new Date(2026, 0, 1, 0, 0))).toEqual({
      start: '2025-12-31',
      end: '2026-01-01',
    });
  });
});

describe('historyPeriod', () => {
  const now = new Date(2026, 10, 2, 9, 30);

  it('gives a rolling window from now back, with no end', () => {
    expect(historyPeriod({ window: '24h', sections: ['feed'] }, now)).toEqual({
      since: new Date(now.getTime() - 24 * 3_600_000),
      until: null,
    });
    expect(historyPeriod({ window: '30d', sections: ['feed'] }, now).since).toEqual(
      new Date(now.getTime() - 30 * 24 * 3_600_000),
    );
  });

  it('gives a custom range from local midnight of its start to local midnight after its end', () => {
    expect(
      historyPeriod(
        { window: 'custom', sections: ['feed'], range: { start: '2026-03-28', end: '2026-03-29' } },
        now,
      ),
    ).toEqual({ since: new Date(2026, 2, 28), until: new Date(2026, 2, 30) });
  });

  it('gives a custom window with no range the last 90 days', () => {
    expect(historyPeriod({ window: 'custom', sections: ['feed'] }, now)).toEqual({
      since: new Date(2026, 7, 4),
      until: new Date(2026, 10, 3),
    });
  });
});
