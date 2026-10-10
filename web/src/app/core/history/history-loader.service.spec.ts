import { Injectable, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { SECTIONS, SectionDefinition, SectionKey } from '../sections/section.models';
import { HistorySource } from './history-source.models';
import { HistoryLoaderService } from './history-loader.service';

interface Entry {
  id: string;
  at: string;
}

const calls: string[] = [];

/** A fake source class for `key`, serving `entries` as a single page. */
const sourceClass = (key: string, entries: Entry[]): Type<HistorySource> => {
  @Injectable({ providedIn: 'root' })
  class FakeSource implements HistorySource<Entry> {
    readonly item = class {};
    page(babyId: string) {
      calls.push(`${key}:${babyId}`);
      return of({ entries, next: null });
    }
    time = (e: Entry) => new Date(e.at);
    kind = () => key;
    inputs = (e: Entry) => ({ e });
  }
  return FakeSource as Type<HistorySource>;
};

const section = (key: SectionKey, source: Type<HistorySource>): SectionDefinition =>
  ({
    key,
    icon: key,
    kinds: [],
    loadCard: () => Promise.resolve(class {}),
    loadSource: () => Promise.resolve(source),
  }) as SectionDefinition;

describe('HistoryLoaderService', () => {
  beforeEach(() => {
    calls.length = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SECTIONS,
          useValue: [
            section('feed', sourceClass('feed', [{ id: 'f1', at: '2026-10-09T10:00:00Z' }])),
            section('sleep', sourceClass('sleep', [{ id: 's1', at: '2026-10-09T11:00:00Z' }])),
            section('diaper', sourceClass('diaper', [{ id: 'd1', at: '2026-10-09T10:00:00Z' }])),
          ],
        },
      ],
    });
  });

  it('merges the registered sources of the given sections, in the given order', async () => {
    const loader = TestBed.inject(HistoryLoaderService).loader(
      'baby-1',
      ['diaper', 'feed'],
      new Date('2026-10-08T12:00:00Z'),
    );

    const page = await firstValueFrom(loader(null));

    expect(page.entries.map((i) => `${i.section}:${i.id}`)).toEqual(['diaper:d1', 'feed:f1']);
    expect(page.next).toBeNull();
    expect(calls.sort()).toEqual(['diaper:baby-1', 'feed:baby-1']);
  });

  it('gives the registered source of a section, loaded once', async () => {
    const service = TestBed.inject(HistoryLoaderService);
    const feed = TestBed.inject(SECTIONS).find((s) => s.key === 'feed')!;
    const load = vi.spyOn(feed, 'loadSource');

    const first = await service.source('feed');
    const again = await service.source('feed');

    expect(first).toBe(again);
    expect(first.kind({ id: 'f1' })).toBe('feed');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
