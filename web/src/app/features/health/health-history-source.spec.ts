import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HealthEntry } from '../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../core/health-entries/health-entry.service';
import { HealthEntryComponent } from './health-entry/health-entry.component';
import { HealthHistorySource } from './health-history-source';

describe('HealthHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const entry = { id: 'h1', time: '2026-10-09T08:30:00Z' } as unknown as HealthEntry;
  let source: HealthHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: HealthEntryService, useValue: service }],
    });
    source = TestBed.inject(HealthHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry by its time, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date('2026-10-09T08:30:00Z'));
    expect(source.kind(entry)).toBe('health');
  });

  it('lists an entry as HealthEntryComponent', () => {
    expect(source.item).toBe(HealthEntryComponent);
    expect(source.inputs(entry)).toEqual({ healthEntry: entry });
  });
});
