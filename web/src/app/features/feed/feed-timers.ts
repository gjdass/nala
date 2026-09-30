import {
  EnvironmentProviders,
  Injectable,
  computed,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { runningSide, sideSeconds, totalSeconds } from '../../core/feeds/breastfeed';
import { BreastfeedSyncService } from '../../core/feeds/breastfeed-sync.service';
import { Feed } from '../../core/feeds/feed.models';
import {
  RUNNING_TIMER_SOURCES,
  RunningTimer,
  RunningTimerSource,
} from '../../core/timers/running-timer.models';

/**
 * The Feed section's running timers for the mini-bar (spec 05): one per breastfeed in progress, of
 * every baby. "Feeding · L" with the running side's live duration, or "Feeding · paused" with the
 * total of both sides.
 */
@Injectable({ providedIn: 'root' })
export class FeedTimerSource implements RunningTimerSource {
  private readonly sync = inject(BreastfeedSyncService);

  readonly timers = computed(() => this.sync.inProgress().map(toTimer));
}

function toTimer(feed: Feed): RunningTimer {
  const side = runningSide(feed);
  return {
    id: `feed-${feed.id}`,
    section: 'feed',
    kind: 'breastfeed',
    entry: feed,
    babyId: feed.babyId,
    label: side ? `feed.timer.${side}` : 'feed.timer.paused',
    seconds: (now) => Math.floor(side ? sideSeconds(feed, side, now) : totalSeconds(feed, now)),
  };
}

/** Registers the Feed section's running timers with the mini-bar. */
export function provideFeedTimers(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RUNNING_TIMER_SOURCES, useFactory: () => [inject(FeedTimerSource)] },
  ]);
}
