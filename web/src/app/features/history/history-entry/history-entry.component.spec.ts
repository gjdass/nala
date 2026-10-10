import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  Type,
  input,
  output,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { FeedService } from '../../../core/feeds/feed.service';
import { HistoryItem, HistorySource } from '../../../core/history/history-source.models';
import { SECTIONS, SectionDefinition, SectionKey } from '../../../core/sections/section.models';
import { NowService } from '../../../core/time/now.service';
import { aBreastfeed, aSegment } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FeedHistorySource } from '../../feed/feed-history-source';
import { HistoryEntryComponent } from './history-entry.component';

interface Entry {
  id: string;
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
  kind = () => 'k';
  inputs = (e: Entry) => ({ label: `item ${e.v}` });
}

const section = (key: SectionKey, source: Type<unknown>): SectionDefinition =>
  ({ key, loadSource: () => Promise.resolve(source) }) as unknown as SectionDefinition;

describe('HistoryEntryComponent', () => {
  let fixture: ComponentFixture<HistoryEntryComponent>;
  const now = signal(new Date('2026-09-30T10:10:00Z').getTime());

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const show = async (item: HistoryItem) => {
    fixture.componentRef.setInput('item', item);
    await fixture.whenStable();
    // The section's source loads asynchronously before its list item renders.
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryEntryComponent, translocoTesting()],
      providers: [
        {
          provide: SECTIONS,
          useValue: [section('sleep', TestSource), section('feed', FeedHistorySource)],
        },
        { provide: FeedService, useValue: {} },
        { provide: NowService, useValue: { now } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryEntryComponent);
  });

  it("renders the section's list item with its inputs, in the section's colour scheme", async () => {
    await show({ id: 's1', section: 'sleep', entry: { id: 's1', v: 'a' } as Entry });

    expect(find('item')?.textContent?.trim()).toBe('item a');
    expect(host().classList).toContain('nala-scheme-sleep');
  });

  it('emits open when the list item is tapped', async () => {
    const opened = vi.fn();
    fixture.componentInstance.open.subscribe(opened);
    await show({ id: 's1', section: 'sleep', entry: { id: 's1', v: 'a' } as Entry });

    find('item')!.click();

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('follows a new entry for the same item (e.g. saved from its sheet)', async () => {
    await show({ id: 's1', section: 'sleep', entry: { id: 's1', v: 'a' } as Entry });
    await show({ id: 's1', section: 'sleep', entry: { id: 's1', v: 'b' } as Entry });

    expect(host().querySelectorAll('[data-testid="item"]')).toHaveLength(1);
    expect(find('item')?.textContent?.trim()).toBe('item b');
  });

  it('shows a live entry with its live total, ticking', async () => {
    const live = aBreastfeed({
      endTime: null,
      segments: [
        aSegment('left', '2026-09-30T10:00:00Z', '2026-09-30T10:05:00Z'),
        aSegment('right', '2026-09-30T10:05:00Z', null),
      ],
    });
    await show({ id: live.id, section: 'feed', entry: live });
    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 10m · L 5m · R 5m');

    now.set(new Date('2026-09-30T10:10:30Z').getTime());
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 10m 30s · L 5m · R 5m 30s');
  });
});
