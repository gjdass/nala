import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Pump } from '../../core/pumps/pump.models';
import { PumpService } from '../../core/pumps/pump.service';
import { PumpEntryComponent } from './pump-entry/pump-entry.component';
import { PumpHistorySource } from './pump-history-source';

describe('PumpHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const entry = { id: 'p1', startTime: '2026-10-09T08:30:00Z', endTime: null } as unknown as Pump;
  let source: PumpHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: PumpService, useValue: service }] });
    source = TestBed.inject(PumpHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry by its startTime, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date('2026-10-09T08:30:00Z'));
    expect(source.kind(entry)).toBe('pump');
  });

  it('lists an entry as PumpEntryComponent', () => {
    expect(source.item).toBe(PumpEntryComponent);
    expect(source.inputs(entry)).toEqual({ pump: entry });
  });
});
