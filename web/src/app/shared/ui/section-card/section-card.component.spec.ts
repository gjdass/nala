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
    [running]="running()"
    (changed)="changes.push($event)"
  >
    <p sectionBanner data-testid="banner">Still feeding?</p>
    <p sectionRunning data-testid="running">Feeding</p>
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
  readonly running = signal(false);
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
    beforeEach(() => create(twelve));

    it('shows the section title in a header band using the section colour tokens', () => {
      expect(text('section-title')).toBe(en.sections.feed);
      const style = find('section-card')?.getAttribute('style') ?? '';
      expect(style).toContain('--nala-section-colour: var(--nala-section-feed)');
      expect(style).toContain('--nala-on-section-colour: var(--nala-on-section-feed)');
    });

    it('gives the + small FAB and the show more button the section colour tokens', async () => {
      expect(find('section-add')?.classList).toContain('nala-section-fab');
      expect(find('section-toggle')?.classList).toContain('nala-section-text-button');
      const style = () => find('section-card')?.getAttribute('style') ?? '';
      expect(style()).toContain('--nala-section-container: var(--nala-section-feed-container)');
      expect(style()).toContain(
        '--nala-on-section-container: var(--nala-on-section-feed-container)',
      );
      expect(style()).toContain('--nala-section-accent: var(--nala-section-feed)');

      fixture.componentInstance.key.set('sleep');
      await fixture.whenStable();

      expect(style()).toContain('--nala-section-container: var(--nala-section-sleep-container)');
      expect(style()).toContain('--nala-section-accent: var(--nala-section-sleep)');
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

    it('links to the section history with "All activities"', () => {
      expect(find('section-history')?.getAttribute('href')).toBe('/history/feed');
      expect(text('section-history')).toContain(en.sectionCard.allActivities);
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

  it('shows the banner above the highlight or the empty state, whatever the entries', async () => {
    await create(['e1']);
    expect(
      find('banner')!.compareDocumentPosition(find('highlight')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fixture.componentInstance.entries.set([]);
    await fixture.whenStable();
    expect(
      find('banner')!.compareDocumentPosition(find('empty')!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the running state instead of the highlight, keeping show more', async () => {
    await create(twelve);
    expect(find('running')).toBeNull();

    fixture.componentInstance.running.set(true);
    await fixture.whenStable();

    expect(text('running')).toBe('Feeding');
    expect(find('highlight')).toBeNull();
    expect(find('section-toggle')).not.toBeNull();
  });

  it('shows the running state instead of the empty state', async () => {
    await create([]);
    fixture.componentInstance.running.set(true);
    await fixture.whenStable();

    expect(text('running')).toBe('Feeding');
    expect(find('empty')).toBeNull();
  });

  describe('recent entries', () => {
    const follows = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    it('lists the 3 most recent entries folded, under the highlight, above show more and the history link', async () => {
      await create(twelve);

      expect(entries()).toEqual(['e1', 'e2', 'e3']);
      const first = find('entry')!;
      expect(follows(find('highlight')!, first)).toBe(true);
      expect(follows(first, find('section-toggle')!)).toBe(true);
      expect(follows(find('section-toggle')!, find('section-history')!)).toBe(true);
    });

    it('lists the 3 most recent entries under the running state too', async () => {
      await create(twelve);
      fixture.componentInstance.running.set(true);
      await fixture.whenStable();

      expect(entries()).toEqual(['e1', 'e2', 'e3']);
    });

    it('lists fewer when there are fewer, without show more', async () => {
      await create(['e1', 'e2']);

      expect(entries()).toEqual(['e1', 'e2']);
      expect(find('section-toggle')).toBeNull();
    });

    it('has no show more when there are exactly 3 entries', async () => {
      await create(['e1', 'e2', 'e3']);

      expect(entries()).toEqual(['e1', 'e2', 'e3']);
      expect(find('section-toggle')).toBeNull();
    });
  });

  describe('show more / show less', () => {
    it('expands to every entry given and folds back to 3', async () => {
      await create(twelve);
      expect(text('section-toggle')).toContain(en.sectionCard.showMore);

      find('section-toggle')!.click();
      await fixture.whenStable();
      expect(entries()).toEqual(twelve);
      expect(text('section-toggle')).toContain(en.sectionCard.showLess);

      find('section-toggle')!.click();
      await fixture.whenStable();
      expect(entries()).toEqual(['e1', 'e2', 'e3']);
    });

    it('remembers the expanded state on this device, per section', async () => {
      await create(twelve, 'feed');
      find('section-toggle')!.click();
      await fixture.whenStable();

      await create(twelve, 'feed');
      expect(entries()).toHaveLength(12);

      await create(twelve, 'diaper');
      expect(entries()).toHaveLength(3);
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

      expect(entries()).toHaveLength(12);
    });
  });
});
