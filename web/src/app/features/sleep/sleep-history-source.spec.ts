import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Sleep } from '../../core/sleeps/sleep.models';
import { SleepService } from '../../core/sleeps/sleep.service';
import { SleepEntryComponent } from './sleep-entry/sleep-entry.component';
import { SleepHistorySource } from './sleep-history-source';

describe('SleepHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const entry = { id: 's1', startTime: '2026-10-09T08:30:00Z', endTime: null } as unknown as Sleep;
  let source: SleepHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: SleepService, useValue: service }] });
    source = TestBed.inject(SleepHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry by its startTime, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date('2026-10-09T08:30:00Z'));
    expect(source.kind(entry)).toBe('sleep');
  });

  it('lists an entry as SleepEntryComponent', () => {
    expect(source.item).toBe(SleepEntryComponent);
    expect(source.inputs(entry)).toEqual({ sleep: entry });
  });
});
