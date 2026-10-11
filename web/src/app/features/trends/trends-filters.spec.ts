import { TestBed } from '@angular/core/testing';
import { TrendsFiltersStore } from './trends-filters';

describe('TrendsFiltersStore', () => {
  const KEY = 'nala.trendsFilters';
  let store: TrendsFiltersStore;

  beforeEach(() => {
    localStorage.clear();
    store = TestBed.inject(TrendsFiltersStore);
  });

  it('gives no section and 7 days with nothing stored', () => {
    expect(store.read()).toEqual({ section: null, range: '7d' });
  });

  it('reads back what was saved', () => {
    store.save({ section: 'sleep', range: '3m' });

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ section: 'sleep', range: '3m' });
    expect(store.read()).toEqual({ section: 'sleep', range: '3m' });
  });

  it.each([
    ['health', 'health'],
    ['an unknown key', 'bath'],
  ])('gives no section for %s', (_, section) => {
    localStorage.setItem(KEY, JSON.stringify({ section, range: '30d' }));

    expect(store.read()).toEqual({ section: null, range: '30d' });
  });

  it('gives 7 days for an unknown range', () => {
    localStorage.setItem(KEY, JSON.stringify({ section: 'pump', range: '1y' }));

    expect(store.read()).toEqual({ section: 'pump', range: '7d' });
  });

  it('gives the defaults for unreadable JSON', () => {
    localStorage.setItem(KEY, '{nope');

    expect(store.read()).toEqual({ section: null, range: '7d' });
  });
});
