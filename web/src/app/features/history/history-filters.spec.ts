import { TestBed } from '@angular/core/testing';
import { SECTION_KEYS } from '../../core/sections/section.models';
import { DEFAULT_FILTERS, HistoryFiltersStore } from './history-filters';

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

  it('leaves a section registered later unselected', () => {
    localStorage.setItem(KEY, JSON.stringify({ window: '24h', sections: ['feed'] }));

    expect(store.read([...SECTION_KEYS]).sections).toEqual(['feed']);
  });
});
