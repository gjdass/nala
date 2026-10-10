import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  Type,
  WritableSignal,
  input,
  output,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, Observable, Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { HistoryLoaderService } from '../../core/history/history-loader.service';
import { HistoryItem, HistorySource } from '../../core/history/history-source.models';
import { DataRefreshService } from '../../core/refresh/data-refresh.service';
import {
  HistoryPage as Page,
  SECTIONS,
  SectionDefinition,
  SectionKey,
  SectionPreference,
} from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { EntrySheetResult } from '../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../shared/ui/entry-sheet/entry-sheet.service';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { fakeDataRefresh } from '../../testing/data-refresh';
import { translocoTesting } from '../../testing/transloco-testing';
import { HistoryPage } from './history.page';

interface Entry {
  id: string;
  kind: string;
  v: string;
}

@Component({
  selector: 'nala-test-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" data-testid="item" (click)="open.emit()">{{ label() }}</button>`,
})
class TestItem {
  readonly label = input.required<string>();
  readonly open = output<void>();
}

@Injectable({ providedIn: 'root' })
class TestSource implements HistorySource<Entry> {
  readonly item = TestItem;
  page = () => EMPTY;
  time = () => new Date(0);
  kind = (e: Entry) => e.kind;
  inputs = (e: Entry) => ({ label: `${e.id}:${e.v}` });
}

const section = (key: SectionKey, source: Type<unknown>): SectionDefinition =>
  ({
    key,
    icon: key,
    kinds: [],
    loadSource: () => Promise.resolve(source),
  }) as unknown as SectionDefinition;

/** Reports every observed element as visible straight away, like a short list. */
class VisibleIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  disconnect(): void {
    // Nothing is kept.
  }
}

const item = (sectionKey: SectionKey, id: string, v = 'a', kind = 'k'): HistoryItem => ({
  id,
  section: sectionKey,
  entry: { id, kind, v } as Entry,
});

describe('HistoryPage', () => {
  const NOW = new Date('2026-10-09T12:00:00Z');

  let fixture: ComponentFixture<HistoryPage>;
  let babiesLoaded: Subject<BabiesResult>;
  let preferences: WritableSignal<SectionPreference[] | null>;
  let loadSections: ReturnType<typeof vi.fn>;
  let loaders: { loader: ReturnType<typeof vi.fn>; source: () => Promise<HistorySource> };
  let calls: {
    babyId: string;
    keys: readonly SectionKey[];
    since: Date;
    cursors: (string | null)[];
  }[];
  let pages: Subject<Page<HistoryItem>>[];
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const lea = { id: 'b1', name: 'Lea', birthDate: '2026-09-01' } as Baby;
  const tom = { id: 'b0', name: 'Tom', birthDate: '2026-05-18' } as Baby;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const items = () =>
    [...host().querySelectorAll('[data-testid="item"]')].map((e) => e.textContent?.trim());
  const loadBabies = async (babies: Baby[]) => {
    babiesLoaded.next({ ok: true, babies });
    await fixture.whenStable();
  };
  /** Answers the last requested page. */
  const answer = async (entries: HistoryItem[], next: string | null = null) => {
    const page = pages.at(-1)!;
    page.next({ entries, next });
    page.complete();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
    localStorage.clear();
    babiesLoaded = new Subject();
    preferences = signal<SectionPreference[] | null>(null);
    loadSections = vi.fn();
    calls = [];
    pages = [];
    loaders = {
      loader: vi.fn((babyId: string, keys: readonly SectionKey[], since: Date) => {
        const call = { babyId, keys, since, cursors: [] as (string | null)[] };
        calls.push(call);
        return (cursor: string | null): Observable<Page<HistoryItem>> => {
          call.cursors.push(cursor);
          const page = new Subject<Page<HistoryItem>>();
          pages.push(page);
          return page;
        };
      }),
      source: () => Promise.resolve(TestBed.inject(TestSource) as HistorySource),
    };
    edited = new Subject();
    entrySheets = { edit: vi.fn(() => edited) };
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HistoryPage, translocoTesting()],
      providers: [
        provideRouter([]),
        {
          provide: SECTIONS,
          useValue: (['feed', 'sleep', 'diaper', 'pump'] as const).map((k) =>
            section(k, TestSource),
          ),
        },
        { provide: BabyService, useValue: { list: () => babiesLoaded } },
        {
          provide: SectionPreferencesService,
          useValue: { preferences, load: loadSections, save: vi.fn() },
        },
        { provide: HistoryLoaderService, useValue: loaders },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: SheetService, useValue: { open: vi.fn(() => new Subject()) } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the top app bar, and no page title nor add button', async () => {
    await loadBabies([lea]);

    expect(host().querySelector('nala-top-app-bar')).not.toBeNull();
    expect(find('selected-name')?.textContent?.trim()).toBe('Lea');
    expect(host().querySelector('h1')).toBeNull();
    expect(host().querySelector('[mat-fab], [mat-mini-fab], nala-kind-picker')).toBeNull();
    expect(host().querySelector('nala-history-list')).not.toBeNull();
  });

  it("shows 03's empty state without a baby, and no list", async () => {
    await loadBabies([]);

    expect(host().querySelector('nala-no-baby')).not.toBeNull();
    expect(find('add-baby')).not.toBeNull();
    expect(host().querySelector('nala-history-list')).toBeNull();
    expect(loaders.loader).not.toHaveBeenCalled();
  });

  it('loads the preferences and the babies', () => {
    expect(loadSections).toHaveBeenCalledTimes(1);
  });

  it('lists the last 24 h of Feed, Sleep and Diaper for the selected baby', async () => {
    await loadBabies([lea]);

    expect(calls).toHaveLength(1);
    expect(calls[0].babyId).toBe('b1');
    expect(calls[0].keys).toEqual(['feed', 'sleep', 'diaper']);
    expect(calls[0].since).toEqual(new Date(NOW.getTime() - 24 * 3_600_000));
    expect(calls[0].cursors).toEqual([null]);
  });

  it('orders the sections by the home order once known, without loading again when it arrives', async () => {
    preferences.set([
      { key: 'diaper', visible: true },
      { key: 'pump', visible: true },
      { key: 'sleep', visible: false },
      { key: 'feed', visible: true },
      { key: 'growth', visible: true },
      { key: 'health', visible: true },
    ]);
    await loadBabies([lea]);
    expect(calls.at(-1)!.keys).toEqual(['diaper', 'sleep', 'feed']);

    preferences.set([...preferences()!].reverse());
    await fixture.whenStable();
    expect(calls).toHaveLength(1);
  });

  it("lists what the loader gives, in its order, each as its section's list item in its colours", async () => {
    await loadBabies([lea]);
    await answer([item('diaper', 'd1'), item('feed', 'f1'), item('sleep', 's1')]);

    expect(items()).toEqual(['d1:a', 'f1:a', 's1:a']);
    const entries = [...host().querySelectorAll('nala-history-entry')];
    expect(entries.map((e) => [...e.classList].find((c) => c.startsWith('nala-scheme-')))).toEqual([
      'nala-scheme-diaper',
      'nala-scheme-feed',
      'nala-scheme-sleep',
    ]);
  });

  it('opens a tapped entry in its sheet and puts the saved one back in place, without a reload', async () => {
    await loadBabies([lea]);
    const diaper = item('diaper', 'd1', 'a', 'change');
    await answer([item('feed', 'f1'), diaper, item('sleep', 's1')]);

    host().querySelectorAll<HTMLButtonElement>('[data-testid="item"]')[1].click();
    await fixture.whenStable();
    expect(entrySheets.edit).toHaveBeenCalledWith('diaper', 'change', diaper.entry);

    edited.next({ saved: { id: 'd1', kind: 'change', v: 'b' } as Entry });
    await fixture.whenStable();

    expect(items()).toEqual(['f1:a', 'd1:b', 's1:a']);
    expect(loaders.loader).toHaveBeenCalledTimes(1);
    expect(calls[0].cursors).toEqual([null]);
  });

  it('removes an entry deleted from its sheet', async () => {
    await loadBabies([lea]);
    await answer([item('feed', 'f1'), item('diaper', 'd1')]);

    host().querySelectorAll<HTMLButtonElement>('[data-testid="item"]')[0].click();
    await fixture.whenStable();
    edited.next({ deleted: 'f1' });
    await fixture.whenStable();

    expect(items()).toEqual(['d1:a']);
  });

  it('says when nothing was logged in the period', async () => {
    await loadBabies([lea]);
    await answer([]);

    expect(find('history-empty')?.textContent).toContain(en.history.emptyPeriod);
  });

  it('shows an error with Try again when a page fails, keeping the entries shown', async () => {
    await loadBabies([lea]);
    await answer([item('feed', 'f1')], '1');
    pages.at(-1)!.error(new Error('offline'));
    await fixture.whenStable();

    expect(find('history-error')).not.toBeNull();
    expect(items()).toEqual(['f1:a']);

    find('history-retry')!.click();
    await answer([item('sleep', 's1')]);

    expect(calls[0].cursors).toEqual([null, '1', '1']);
    expect(items()).toEqual(['f1:a', 's1:a']);
  });

  it('starts again from the first page for another baby', async () => {
    await loadBabies([lea, tom]);
    await answer([item('feed', 'f1')]);

    TestBed.inject(SelectedBabyService).select('b0');
    await fixture.whenStable();

    expect(calls.at(-1)!.babyId).toBe('b0');
    expect(calls.at(-1)!.cursors).toEqual([null]);
  });

  it('reloads the babies and the list from the first page on the reload signal', async () => {
    await loadBabies([lea]);
    await answer([item('feed', 'f1')]);
    const list = vi.spyOn(TestBed.inject(BabyService), 'list');
    loadSections.mockClear();

    refresh.reload.set(1);
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(1);
    expect(loadSections).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].cursors).toEqual([null]);
  });
});
