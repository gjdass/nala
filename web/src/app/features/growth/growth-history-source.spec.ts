import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Baby } from '../../core/babies/baby.models';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { GrowthEntry } from '../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../core/growth-entries/growth-entry.service';
import { GrowthEntryComponent } from './growth-entry/growth-entry.component';
import { GrowthHistorySource } from './growth-history-source';

describe('GrowthHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const selected = signal<Baby | null>(null);
  const entry = { id: 'g1', kind: 'milestone', date: '2026-10-09' } as unknown as GrowthEntry;
  let source: GrowthHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    selected.set({ id: 'baby-1', birthDate: '2026-03-02' } as Baby);
    TestBed.configureTestingModule({
      providers: [
        { provide: GrowthEntryService, useValue: service },
        { provide: SelectedBabyService, useValue: { selected } },
      ],
    });
    source = TestBed.inject(GrowthHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry at local midnight of its date, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date(2026, 9, 9));
    expect(source.kind(entry)).toBe('milestone');
  });

  it('lists an entry as GrowthEntryComponent, with the selected baby birth date', () => {
    expect(source.item).toBe(GrowthEntryComponent);
    expect(source.inputs(entry)).toEqual({ growthEntry: entry, birthDate: '2026-03-02' });

    selected.set(null);
    expect(source.inputs(entry)).toEqual({ growthEntry: entry, birthDate: null });
  });
});
