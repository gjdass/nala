import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Baby, BabySheetResult } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { HistoryPage } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { aGrowthEntry } from '../../../testing/growth-entries';
import { fakeOfflineQueue } from '../../../testing/offline-queue';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabySheetComponent } from '../../babies/baby-sheet/baby-sheet.component';
import { GrowthHistoryComponent } from './growth-history.component';

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

const baby = (id: string, overrides: Partial<Baby> = {}): Baby => ({
  id,
  name: id,
  birthDate: '2026-08-15',
  sex: 'unspecified',
  birthWeightG: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
  ...overrides,
});
/** A head circumference alone, whose value tells it apart. */
const entryOf = (id: string, head: number) =>
  aGrowthEntry({ id, weightG: null, lengthCm: null, headCircumferenceCm: head });

describe('GrowthHistoryComponent', () => {
  let fixture: ComponentFixture<GrowthHistoryComponent>;
  let pages: Subject<HistoryPage<GrowthEntry>>[];
  let growthEntries: { page: ReturnType<typeof vi.fn> };
  let selected: ReturnType<typeof signal<Baby | null>>;
  let edited: Subject<EntrySheetResult | undefined>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };
  let queue: ReturnType<typeof fakeOfflineQueue>;
  let babySheet: Subject<BabySheetResult | undefined>;
  let sheets: { open: ReturnType<typeof vi.fn> };
  let store: {
    selected: typeof selected;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const summaries = () =>
    [...host().querySelectorAll('[data-testid="entry-summary"]')].map((e) =>
      e.textContent?.replace(/\s+/g, ' ').trim(),
    );

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
    pages = [];
    growthEntries = {
      page: vi.fn((): Observable<HistoryPage<GrowthEntry>> => {
        const page = new Subject<HistoryPage<GrowthEntry>>();
        pages.push(page);
        return page;
      }),
    };
    selected = signal<Baby | null>(baby('b1'));
    edited = new Subject();
    entrySheets = { edit: vi.fn(() => edited) };
    queue = fakeOfflineQueue();
    babySheet = new Subject();
    sheets = { open: vi.fn(() => babySheet) };
    store = { selected, update: vi.fn(), remove: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [GrowthHistoryComponent, translocoTesting()],
      providers: [
        { provide: GrowthEntryService, useValue: growthEntries },
        { provide: SelectedBabyService, useValue: store },
        { provide: SheetService, useValue: sheets },
        { provide: EntrySheetService, useValue: entrySheets },
        { provide: OfflineQueueService, useValue: queue },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GrowthHistoryComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the selected baby pages, following the cursor', async () => {
    expect(growthEntries.page).toHaveBeenCalledWith('b1', null);

    pages[0].next({ entries: [entryOf('g2', 39)], next: 'c2' });
    await fixture.whenStable();
    expect(growthEntries.page).toHaveBeenLastCalledWith('b1', 'c2');

    pages[1].next({ entries: [entryOf('g1', 38)], next: null });
    await fixture.whenStable();
    expect(summaries()).toEqual(['Head 39.0 cm', 'Head 38.0 cm']);
  });

  it("shows each entry's date with the baby's age on that date", async () => {
    pages[0].next({ entries: [aGrowthEntry({ date: '2026-09-28' })], next: null });
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="entry-label"]')?.textContent?.trim()).toBe(
      '6 weeks 2 days',
    );
  });

  it('starts again from the first page for another baby', async () => {
    pages[0].next({ entries: [entryOf('g1', 38)], next: null });
    await fixture.whenStable();

    selected.set(baby('b2'));
    await fixture.whenStable();

    expect(growthEntries.page).toHaveBeenLastCalledWith('b2', null);
  });

  it('opens an entry for editing and puts the saved one back in place', async () => {
    const tapped = entryOf('g1', 38);
    pages[0].next({ entries: [entryOf('g2', 39), tapped], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-growth-entry button')[1].click();
    expect(entrySheets.edit).toHaveBeenCalledWith('growth', 'measurement', tapped);

    edited.next({ saved: entryOf('g1', 40) });
    await fixture.whenStable();
    expect(summaries()).toEqual(['Head 39.0 cm', 'Head 40.0 cm']);
    expect(growthEntries.page).toHaveBeenCalledTimes(1);
  });

  it('removes an entry deleted from the history', async () => {
    pages[0].next({ entries: [entryOf('g2', 39), entryOf('g1', 38)], next: null });
    await fixture.whenStable();

    host().querySelectorAll<HTMLButtonElement>('nala-growth-entry button')[0].click();
    edited.next({ deleted: 'g2' });
    await fixture.whenStable();

    expect(summaries()).toEqual(['Head 38.0 cm']);
  });

  it('starts again from the first page once changes kept on the device have been sent', async () => {
    pages[0].next({ entries: [entryOf('g1', 38)], next: null });
    await fixture.whenStable();

    queue.sent.set(1);
    await fixture.whenStable();

    expect(growthEntries.page).toHaveBeenCalledTimes(2);
    expect(growthEntries.page).toHaveBeenLastCalledWith('b1', null);
  });

  describe('Birth item', () => {
    const born = baby('b1', { birthWeightG: 3400, birthLengthCm: 50.5 });
    const birth = () => host().querySelector<HTMLElement>('nala-growth-birth');

    beforeEach(async () => {
      selected.set(born);
      await fixture.whenStable();
    });

    it('ends the history after the last page when the baby has a birth measurement', async () => {
      pages.at(-1)!.next({ entries: [entryOf('g2', 39)], next: 'c2' });
      await fixture.whenStable();
      expect(birth()).toBeNull();

      pages.at(-1)!.next({ entries: [entryOf('g1', 38)], next: null });
      await fixture.whenStable();

      expect(summaries()).toEqual(['Head 39.0 cm', 'Head 38.0 cm', '3.400 kg · 50.5 cm']);
      expect(birth()?.querySelector('[data-testid="entry-label"]')?.textContent?.trim()).toBe(
        'Birth',
      );
    });

    it('is shown alone, without the empty state, when there is no entry', async () => {
      pages.at(-1)!.next({ entries: [], next: null });
      await fixture.whenStable();

      expect(birth()).toBeTruthy();
      expect(host().querySelector('[data-testid="history-empty"]')).toBeNull();
    });

    it('is not shown without a birth measurement', async () => {
      selected.set(baby('b1'));
      await fixture.whenStable();
      pages.at(-1)!.next({ entries: [], next: null });
      await fixture.whenStable();

      expect(birth()).toBeNull();
      expect(host().querySelector('[data-testid="history-empty"]')).toBeTruthy();
    });

    it("opens the baby's profile form", async () => {
      pages.at(-1)!.next({ entries: [], next: null });
      await fixture.whenStable();

      birth()!.querySelector<HTMLButtonElement>('button')!.click();

      expect(sheets.open).toHaveBeenCalledWith(BabySheetComponent, born);
    });

    it('follows a profile saved from it', async () => {
      pages.at(-1)!.next({ entries: [], next: null });
      await fixture.whenStable();
      birth()!.querySelector<HTMLButtonElement>('button')!.click();

      const saved = { ...born, birthWeightG: 3500 };
      babySheet.next({ saved });

      expect(store.update).toHaveBeenCalledWith(saved);
    });

    it('drops a baby deleted from it', async () => {
      pages.at(-1)!.next({ entries: [], next: null });
      await fixture.whenStable();
      birth()!.querySelector<HTMLButtonElement>('button')!.click();

      babySheet.next({ deleted: 'b1' });
      babySheet.next(undefined);

      expect(store.remove).toHaveBeenCalledWith('b1');
      expect(store.update).not.toHaveBeenCalled();
    });
  });
});
