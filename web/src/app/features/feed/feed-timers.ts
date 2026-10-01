import {
  EnvironmentProviders,
  Injectable,
  computed,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { runningSide, sideSeconds } from '../../core/feeds/breastfeed';
import { BreastfeedSyncService } from '../../core/feeds/breastfeed-sync.service';
import { BreastSide, Feed } from '../../core/feeds/feed.models';
import {
  RUNNING_TIMER_SOURCES,
  RunningTimer,
  RunningTimerSource,
} from '../../core/timers/running-timer.models';

/**
 * The Feed section's running timers for the mini-bar (spec 05): one per live breastfeed, of every
 * baby, "Feeding · L" with the running side's live duration. A stopped feed has none.
 */
@Injectable({ providedIn: 'root' })
export class FeedTimerSource implements RunningTimerSource {
  private readonly sync = inject(BreastfeedSyncService);

  readonly timers = computed(() =>
    this.sync.inProgress().flatMap((feed) => {
      const side = runningSide(feed);
      return side ? [toTimer(feed, side)] : [];
    }),
  );
}

function toTimer(feed: Feed, side: BreastSide): RunningTimer {
  return {
    id: `feed-${feed.id}`,
    section: 'feed',
    kind: 'breastfeed',
    entry: feed,
    babyId: feed.babyId,
    label: `feed.timer.${side}`,
    seconds: (now) => Math.floor(sideSeconds(feed, side, now)),
  };
}

/** Registers the Feed section's running timers with the mini-bar. */
export function provideFeedTimers(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RUNNING_TIMER_SOURCES, useFactory: () => [inject(FeedTimerSource)] },
  ]);
}
