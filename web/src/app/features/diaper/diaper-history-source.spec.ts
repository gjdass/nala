import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Diaper } from '../../core/diapers/diaper.models';
import { DiaperService } from '../../core/diapers/diaper.service';
import { DiaperEntryComponent } from './diaper-entry/diaper-entry.component';
import { DiaperHistorySource } from './diaper-history-source';

describe('DiaperHistorySource', () => {
  const page = { entries: [], next: null };
  const service = { page: vi.fn(() => of(page)) };
  const entry = { id: 'd1', time: '2026-10-09T08:30:00Z' } as unknown as Diaper;
  let source: DiaperHistorySource;

  beforeEach(() => {
    service.page.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: DiaperService, useValue: service }] });
    source = TestBed.inject(DiaperHistorySource);
  });

  it('reads the baby pages from the section list, with the asked limit', () => {
    let loaded: unknown;
    source.page('baby-1', 'c1', 50).subscribe((p) => (loaded = p));

    expect(service.page).toHaveBeenCalledWith('baby-1', 'c1', 50);
    expect(loaded).toBe(page);
  });

  it('times an entry by its time, and gives its kind', () => {
    expect(source.time(entry)).toEqual(new Date('2026-10-09T08:30:00Z'));
    expect(source.kind(entry)).toBe('diaper');
  });

  it('lists an entry as DiaperEntryComponent', () => {
    expect(source.item).toBe(DiaperEntryComponent);
    expect(source.inputs(entry)).toEqual({ diaper: entry });
  });
});
