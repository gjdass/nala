import { TestBed } from '@angular/core/testing';
import { BreastfeedSyncService } from '../../core/feeds/breastfeed-sync.service';
import { RUNNING_TIMER_SOURCES } from '../../core/timers/running-timer.models';
import { fakeBreastfeedSync } from '../../testing/breastfeed-sync';
import { aBreastfeed, aSegment } from '../../testing/feeds';
import { FeedTimerSource, provideFeedTimers } from './feed-timers';

const at = (time: string) => new Date(`2026-09-30T${time}Z`).getTime();
const iso = (time: string) => `2026-09-30T${time}Z`;

describe('FeedTimerSource', () => {
  let sync: ReturnType<typeof fakeBreastfeedSync>;
  let source: FeedTimerSource;

  beforeEach(() => {
    sync = fakeBreastfeedSync();
    TestBed.configureTestingModule({
      providers: [provideFeedTimers(), { provide: BreastfeedSyncService, useValue: sync }],
    });
    source = TestBed.inject(FeedTimerSource);
  });

  it('is registered as a running timer source', () => {
    expect(TestBed.inject(RUNNING_TIMER_SOURCES)).toContain(source);
  });

  it('has one timer per live breastfeed, opening it in the Breastfeed sheet', () => {
    const feed = aBreastfeed({
      id: 'f9',
      babyId: 'b2',
      endTime: null,
      segments: [aSegment('left', iso('10:00:00'), null)],
    });
    sync.inProgress.set([feed]);

    const [timer] = source.timers();

    expect(source.timers()).toHaveLength(1);
    expect(timer).toMatchObject({
      id: 'feed-f9',
      section: 'feed',
      kind: 'breastfeed',
      entry: feed,
      babyId: 'b2',
    });
  });

  it('shows the running side and its live duration', () => {
    sync.inProgress.set([
      aBreastfeed({
        endTime: null,
        segments: [
          aSegment('right', iso('10:00:00'), iso('10:03:00')),
          aSegment('left', iso('10:03:00'), null),
        ],
      }),
    ]);

    const [timer] = source.timers();

    expect(timer.label).toBe('feed.timer.left');
    expect(timer.seconds(at('10:15:04'))).toBe(12 * 60 + 4);
  });

  it('has no row for a feed that is not live (stopped: an ordinary feed)', () => {
    sync.inProgress.set([aBreastfeed()]);

    expect(source.timers()).toEqual([]);
  });
});
