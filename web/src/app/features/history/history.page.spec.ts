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
import { Router, provideRouter } from '@angular/router';
import { EMPTY, Observable, Subject, of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { FamiliesResult } from '../../core/families/family.models';
import { FamilyService } from '../../core/families/family.service';
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

  const lea = { id: 'b1', familyId: 'f1', name: 'Lea', birthDate: '2026-09-01' } as Baby;
  const tom = { id: 'b0', familyId: 'f1', name: 'Tom', birthDate: '2026-05-18' } as Baby;
  let families: FamiliesResult;

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
    families = { ok: true, families: [{ id: 'f1', name: 'Martins', isAdmin: true }] };
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
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: SECTIONS,
          useValue: (['feed', 'sleep', 'diaper', 'pump'] as const).map((k) =>
            section(k, TestSource),
          ),
        },
        { provide: BabyService, useValue: { list: () => babiesLoaded } },
        { provide: FamilyService, useValue: { list: () => of(families) } },
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
    const bar = host().querySelector('nala-history-filter-bar');
    expect(bar).not.toBeNull();
    expect(
      bar!.compareDocumentPosition(host().querySelector('nala-history-list')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the filter bar at the top while the list scrolls', async () => {
    await loadBabies([lea]);

    expect(getComputedStyle(host().querySelector('nala-history-filter-bar')!).position).toBe(
      'sticky',
    );
  });

  it("shows 03's empty state without a baby, and no list", async () => {
    await loadBabies([]);

    expect(host().querySelector('nala-no-baby')).not.toBeNull();
    expect(find('add-baby')).not.toBeNull();
    expect(host().querySelector('nala-history-list')).toBeNull();
    expect(host().querySelector('nala-history-filter-bar')).toBeNull();
    expect(loaders.loader).not.toHaveBeenCalled();
  });

  it('shows the no-family empty state to a user in no family, and no list', async () => {
    families = { ok: true, families: [] };
    TestBed.inject(SelectedBabyService).refresh();
    await loadBabies([]);

    expect(host().querySelector('nala-no-family')).not.toBeNull();
    expect(host().querySelector('nala-no-baby')).toBeNull();
    expect(host().querySelector('nala-history-list')).toBeNull();
    expect(host().querySelector('nala-history-filter-bar')).toBeNull();
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

  describe('filter bar', () => {
    const KEY = 'nala.historyFilters';
    const DAY = 24 * 3_600_000;
    const checkedWindow = () =>
      find('window-chip')
        ?.querySelector('.mdc-evolution-chip__text-label')
        ?.textContent?.trim();
    const pickWindow = async (index: number) => {
      find('window-chip')!.click();
      await fixture.whenStable();
      document.querySelectorAll<HTMLButtonElement>('[data-testid="window-option"]')[index].click();
      await fixture.whenStable();
    };
    const chip = () => find('sections-chip')?.textContent;
    const menuRows = () => [
      ...document.querySelectorAll<HTMLButtonElement>('[data-testid="section-option"]'),
    ];
    const openMenu = async () => {
      find('sections-chip')!.click();
      await fixture.whenStable();
    };
    const recreate = async () => {
      fixture.destroy();
      fixture = TestBed.createComponent(HistoryPage);
      await fixture.whenStable();
    };

    it('starts with 24 h and Feed, Sleep and Diaper when nothing is remembered', async () => {
      await loadBabies([lea]);

      expect(checkedWindow()).toBe(en.history.window['24h']);
      expect(chip()).toContain('Sections · 3');
      expect(calls.at(-1)!.keys).toEqual(['feed', 'sleep', 'diaper']);
    });

    it('restores the remembered filters, the sections in home order', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ window: '7d', sections: ['pump', 'feed', 'bath'] }),
      );
      await recreate();
      await loadBabies([lea]);

      expect(checkedWindow()).toBe(en.history.window['7d']);
      expect(chip()).toContain('Sections · 2');
      expect(calls.at(-1)!.keys).toEqual(['feed', 'pump']);
      expect(calls.at(-1)!.since).toEqual(new Date(NOW.getTime() - 7 * DAY));
    });

    it('loads the list again from the first page with another window, and remembers it', async () => {
      await loadBabies([lea]);
      await answer([item('feed', 'f1')], '1');

      await pickWindow(2);

      expect(calls).toHaveLength(2);
      expect(calls[1].since).toEqual(new Date(NOW.getTime() - 30 * DAY));
      expect(calls[1].cursors).toEqual([null]);
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
        window: '30d',
        sections: ['feed', 'sleep', 'diaper'],
      });
    });

    it('loads the list again from the first page with other sections, and remembers them', async () => {
      await loadBabies([lea]);
      await openMenu();

      menuRows()[3].click(); // pump
      await fixture.whenStable();
      expect(calls.at(-1)!.keys).toEqual(['feed', 'sleep', 'diaper', 'pump']);
      expect(calls.at(-1)!.cursors).toEqual([null]);

      menuRows()[1].click(); // sleep
      await fixture.whenStable();
      expect(calls.at(-1)!.keys).toEqual(['feed', 'diaper', 'pump']);
      expect(chip()).toContain('Sections · 3');
      expect(JSON.parse(localStorage.getItem(KEY)!).sections.sort()).toEqual([
        'diaper',
        'feed',
        'pump',
      ]);
    });

    it('lists the registered sections in the home order, the hidden ones after a divider', async () => {
      preferences.set([
        { key: 'diaper', visible: true },
        { key: 'growth', visible: true },
        { key: 'pump', visible: false },
        { key: 'feed', visible: true },
        { key: 'sleep', visible: false },
        { key: 'health', visible: true },
      ]);
      await loadBabies([lea]);
      await openMenu();

      expect(
        menuRows().map((r) =>
          r.querySelector('[data-testid="section-title"]')?.textContent?.trim(),
        ),
      ).toEqual([en.sections.diaper, en.sections.feed, en.sections.pump, en.sections.sleep]);
      expect(document.querySelectorAll('.mat-mdc-menu-panel mat-divider')).toHaveLength(1);
    });

    it('lists every registered section in the default order before the home order is known', async () => {
      await loadBabies([lea]);
      await openMenu();

      expect(
        menuRows().map((r) =>
          r.querySelector('[data-testid="section-title"]')?.textContent?.trim(),
        ),
      ).toEqual([en.sections.feed, en.sections.sleep, en.sections.diaper, en.sections.pump]);
      expect(document.querySelector('.mat-mdc-menu-panel mat-divider')).toBeNull();
    });

    describe('opened from a card', () => {
      const REMEMBERED = { window: '30d', sections: ['sleep'] };
      const visit = async (url: string) => {
        await TestBed.inject(Router).navigateByUrl(url);
        await fixture.whenStable();
      };

      beforeEach(() => localStorage.setItem(KEY, JSON.stringify(REMEMBERED)));

      it('shows only that section over the last 7 days, whatever is remembered', async () => {
        await visit('/history?section=pump');
        await recreate();
        await loadBabies([lea]);

        expect(checkedWindow()).toBe(en.history.window['7d']);
        expect(chip()).toContain('Sections · 1');
        expect(calls.at(-1)!.keys).toEqual(['pump']);
        expect(calls.at(-1)!.since).toEqual(new Date(NOW.getTime() - 7 * DAY));
      });

      it('changes the list but saves nothing when a filter changes there', async () => {
        await visit('/history?section=pump');
        await recreate();
        await loadBabies([lea]);

        await pickWindow(0);
        await openMenu();
        menuRows()[0].click(); // feed
        await fixture.whenStable();

        expect(calls.at(-1)!.keys).toEqual(['feed', 'pump']);
        expect(calls.at(-1)!.since).toEqual(new Date(NOW.getTime() - DAY));
        expect(calls.at(-1)!.cursors).toEqual([null]);
        expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(REMEMBERED);
      });

      it('shows the remembered filters again once History is opened from the bottom bar', async () => {
        await visit('/history?section=pump');
        await recreate();
        await loadBabies([lea]);

        await visit('/history');

        expect(checkedWindow()).toBe(en.history.window['30d']);
        expect(calls.at(-1)!.keys).toEqual(['sleep']);
        expect(calls.at(-1)!.since).toEqual(new Date(NOW.getTime() - 30 * DAY));
        expect(calls.at(-1)!.cursors).toEqual([null]);
      });

      it('ignores an unknown section in the link', async () => {
        await visit('/history?section=bath');
        await recreate();
        await loadBabies([lea]);

        expect(checkedWindow()).toBe(en.history.window['30d']);
        expect(calls.at(-1)!.keys).toEqual(['sleep']);
      });
    });
  });
});
