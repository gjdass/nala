import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SectionKey } from '../../../core/sections/section.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { EntrySheetResult } from '../entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../entry-sheet/entry-sheet.service';
import { SectionCardComponent } from './section-card.component';
import { SectionEntryDirective } from './section-entry.directive';

@Component({
  imports: [SectionCardComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-section-card
    [key]="key()"
    [entries]="entries()"
    (changed)="changes.push($event)"
  >
    <p sectionHighlight data-testid="highlight">Last feeding</p>
    <p sectionEmpty data-testid="empty">No feed yet</p>
    <ng-template nalaSectionEntry let-entry>
      <span data-testid="entry">{{ entry }}</span>
    </ng-template>
  </nala-section-card>`,
})
class Host {
  readonly key = signal<SectionKey>('feed');
  readonly entries = signal<readonly string[] | null>(null);
  readonly changes: EntrySheetResult[] = [];
}

const twelve = Array.from({ length: 12 }, (_, i) => `e${i + 1}`);

describe('SectionCardComponent', () => {
  let fixture: ComponentFixture<Host>;
  let sheetClosed: Subject<EntrySheetResult | undefined>;
  let entrySheets: { add: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();
  const entries = () =>
    [...host().querySelectorAll('[data-testid="entry"]')].map((e) => e.textContent?.trim());

  const create = async (initial: readonly string[] | null = null, key: SectionKey = 'feed') => {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.key.set(key);
    fixture.componentInstance.entries.set(initial);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    sheetClosed = new Subject();
    entrySheets = { add: vi.fn(() => sheetClosed) };
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
      providers: [provideRouter([]), { provide: EntrySheetService, useValue: entrySheets }],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('frame', () => {
    beforeEach(() => create(['e1']));

    it('shows the section title in a header band using the section colour tokens', () => {
      expect(text('section-title')).toBe(en.sections.feed);
      const style = find('section-header')?.getAttribute('style') ?? '';
      expect(style).toContain('var(--nala-section-feed)');
      expect(style).toContain('var(--nala-on-section-feed)');
    });

    it('has a labelled + small FAB that opens the section add flow', () => {
      const add = find('section-add') as HTMLButtonElement;
      expect(add.hasAttribute('mat-mini-fab')).toBe(true);
      expect(add.getAttribute('aria-label')).toBe('Add Feed');

      add.click();

      expect(entrySheets.add).toHaveBeenCalledWith('feed');
    });

    it('emits changed with what the sheet saved', () => {
      find('section-add')!.click();
      sheetClosed.next({ saved: { id: 'f1' } });

      expect(fixture.componentInstance.changes).toEqual([{ saved: { id: 'f1' } }]);
    });

    it('emits nothing when the sheet or kind picker closes without a result', () => {
      find('section-add')!.click();
      sheetClosed.next(undefined);

      expect(fixture.componentInstance.changes).toEqual([]);
    });

    it('links to the section history', () => {
      expect(find('section-history')?.getAttribute('href')).toBe('/history/feed');
      expect(text('section-history')).toContain(en.sectionCard.viewHistory);
    });
  });

  it('shows neither the highlight nor the empty state while loading', async () => {
    await create(null);

    expect(find('highlight')).toBeNull();
    expect(find('empty')).toBeNull();
    expect(find('section-toggle')).toBeNull();
  });

  it('shows the empty state instead of the highlight, and no show more, without entries', async () => {
    await create([]);

    expect(text('empty')).toBe('No feed yet');
    expect(find('highlight')).toBeNull();
    expect(find('section-toggle')).toBeNull();
  });

  it('shows the highlight once there are entries', async () => {
    await create(['e1']);

    expect(text('highlight')).toBe('Last feeding');
    expect(find('empty')).toBeNull();
  });

  describe('show more / show less', () => {
    it('starts collapsed, expands to the 10 most recent entries and collapses again', async () => {
      await create(twelve);
      expect(entries()).toEqual([]);
      expect(text('section-toggle')).toContain(en.sectionCard.showMore);

      find('section-toggle')!.click();
      await fixture.whenStable();
      expect(entries()).toEqual(twelve.slice(0, 10));
      expect(text('section-toggle')).toContain(en.sectionCard.showLess);

      find('section-toggle')!.click();
      await fixture.whenStable();
      expect(entries()).toEqual([]);
    });

    it('remembers the expanded state on this device, per section', async () => {
      await create(twelve, 'feed');
      find('section-toggle')!.click();
      await fixture.whenStable();

      await create(twelve, 'feed');
      expect(entries()).toHaveLength(10);

      await create(twelve, 'diaper');
      expect(entries()).toEqual([]);
    });

    it('still expands when storage is unavailable', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      await create(twelve);

      find('section-toggle')!.click();
      await fixture.whenStable();

      expect(entries()).toHaveLength(10);
    });
  });
});
