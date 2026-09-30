import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { HistoryPage, HistoryPageLoader, SectionKey } from '../../../core/sections/section.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SectionEntryDirective } from '../section-card/section-entry.directive';
import { HistoryListComponent } from './history-list.component';

interface Entry {
  id: string;
  v: string;
}

@Component({
  imports: [HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-history-list [key]="key()" [loader]="loader()">
    <ng-template nalaSectionEntry let-entry>
      <span data-testid="entry">{{ entry.id }}:{{ entry.v }}</span>
    </ng-template>
  </nala-history-list>`,
})
class Host {
  readonly key = signal<SectionKey>('feed');
  readonly loader = signal<HistoryPageLoader<Entry>>(() => new Subject());
  readonly list = viewChild.required(HistoryListComponent);
}

/** Records every observed element; `show()` reports them as visible, like scrolling to them. */
class FakeIntersectionObserver {
  static all: FakeIntersectionObserver[] = [];
  readonly targets: Element[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.all.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    this.targets.splice(this.targets.indexOf(target), 1);
  }

  disconnect(): void {
    this.targets.length = 0;
  }

  report(isIntersecting: boolean): void {
    const entries = this.targets.map((target) => ({ target, isIntersecting }));
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

const entry = (id: string, v = 'a'): Entry => ({ id, v });

describe('HistoryListComponent', () => {
  let fixture: ComponentFixture<Host>;
  let cursors: (string | null)[];
  let pending: Subject<HistoryPage<Entry>>[];

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const entries = () =>
    [...host().querySelectorAll('[data-testid="entry"]')].map((e) => e.textContent?.trim());

  const loader =
    (calls: (string | null)[], pages: Subject<HistoryPage<Entry>>[]): HistoryPageLoader<Entry> =>
    (cursor): Observable<HistoryPage<Entry>> => {
      calls.push(cursor);
      const page = new Subject<HistoryPage<Entry>>();
      pages.push(page);
      return page;
    };

  /** Answers the last requested page. */
  const answer = async (entries: Entry[], next: string | null) => {
    pending.at(-1)!.next({ entries, next });
    pending.at(-1)!.complete();
    await fixture.whenStable();
  };
  const fail = async () => {
    pending.at(-1)!.error(new Error('offline'));
    await fixture.whenStable();
  };
  /** The end of the list scrolls into view (or out of it). */
  const endVisible = async (visible = true) => {
    FakeIntersectionObserver.all.forEach((o) => o.report(visible));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    FakeIntersectionObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    cursors = [];
    pending = [];
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loader.set(loader(cursors, pending));
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the first page and renders each entry through the entry template, in order', async () => {
    expect(cursors).toEqual([null]);

    await answer([entry('3'), entry('2'), entry('1')], 'c1');

    expect(entries()).toEqual(['3:a', '2:a', '1:a']);
  });

  it('shows a progress indicator while a page loads', async () => {
    expect(find('history-loading')).toBeTruthy();

    await answer([entry('1')], null);

    expect(find('history-loading')).toBeNull();
  });

  it('loads the next page with the previous cursor when the end of the list comes into view', async () => {
    await answer([entry('3'), entry('2')], 'c1');
    await endVisible(false);
    expect(cursors).toEqual([null]);

    await endVisible();
    expect(cursors).toEqual([null, 'c1']);
    await answer([entry('1')], null);

    expect(entries()).toEqual(['3:a', '2:a', '1:a']);
  });

  it('keeps loading while the end of the list stays in view after a page', async () => {
    await endVisible();
    await answer([entry('3')], 'c1');

    expect(cursors).toEqual([null, 'c1']);
  });

  it('stops once the last page is loaded', async () => {
    await answer([entry('1')], null);
    await endVisible();

    expect(cursors).toEqual([null]);
  });

  it('never loads two pages at once', async () => {
    await endVisible();
    await endVisible();

    expect(cursors).toEqual([null]);
  });

  it('shows the empty state when there is no entry', async () => {
    expect(find('history-empty')).toBeNull();

    await answer([], null);

    expect(find('history-empty')?.textContent).toContain(en.history.empty.title);
  });

  it('shows an error with Try again when a page fails, keeping the loaded entries', async () => {
    await answer([entry('2')], 'c1');
    await endVisible();
    await fail();

    expect(find('history-error')?.textContent).toContain(en.history.loadError);
    expect(find('history-loading')).toBeNull();
    expect(entries()).toEqual(['2:a']);
    await endVisible();
    expect(cursors).toEqual([null, 'c1']);

    find('history-retry')!.click();
    await fixture.whenStable();
    expect(cursors).toEqual([null, 'c1', 'c1']);
    expect(find('history-error')).toBeNull();

    await answer([entry('1')], null);
    expect(entries()).toEqual(['2:a', '1:a']);
  });

  it('does not show the empty state when the first page fails', async () => {
    await fail();

    expect(find('history-error')).toBeTruthy();
    expect(find('history-empty')).toBeNull();
  });

  it('starts again from the first page when the loader changes (other baby)', async () => {
    await answer([entry('2')], 'c1');
    const otherCursors: (string | null)[] = [];
    fixture.componentInstance.loader.set(loader(otherCursors, pending));
    await fixture.whenStable();

    expect(otherCursors).toEqual([null]);
    expect(entries()).toEqual([]);
    await answer([entry('9')], null);
    expect(entries()).toEqual(['9:a']);
  });

  it('ignores a page of the previous loader that arrives late', async () => {
    const stale = pending[0];
    fixture.componentInstance.loader.set(loader([], pending));
    await fixture.whenStable();
    stale.next({ entries: [entry('old')], next: null });
    await fixture.whenStable();

    expect(entries()).toEqual([]);
  });

  it('replaces a saved entry where it is', async () => {
    await answer([entry('3'), entry('2'), entry('1')], null);

    fixture.componentInstance.list().apply({ saved: entry('2', 'b') });
    await fixture.whenStable();

    expect(entries()).toEqual(['3:a', '2:b', '1:a']);
  });

  it('removes a deleted entry', async () => {
    await answer([entry('3'), entry('2'), entry('1')], null);

    fixture.componentInstance.list().apply({ deleted: '2' });
    await fixture.whenStable();

    expect(entries()).toEqual(['3:a', '1:a']);
  });

  it('leaves the list as it is for a change kept on the device (offline)', async () => {
    await answer([entry('2'), entry('1')], null);

    fixture.componentInstance.list().apply({ queued: true });
    await fixture.whenStable();

    expect(entries()).toEqual(['2:a', '1:a']);
  });

  it('shows the empty state once the last entry is deleted', async () => {
    await answer([entry('1')], null);

    fixture.componentInstance.list().apply({ deleted: '1' });
    await fixture.whenStable();

    expect(find('history-empty')).toBeTruthy();
  });

  it('lists only the entries, without totals or charts', async () => {
    await answer([entry('2'), entry('1')], null);

    const list = host().querySelector('mat-action-list')!;
    expect([...list.children].map((c) => c.getAttribute('data-testid'))).toEqual([
      'entry',
      'entry',
    ]);
  });

  it('draws the duration bars in the section colour', async () => {
    fixture.componentInstance.key.set('sleep');
    await answer([entry('1')], null);

    expect(find('history-body')?.getAttribute('style')).toContain(
      '--nala-entry-bar: var(--nala-section-sleep)',
    );
  });
});
