import { BreastSide, Feed } from './feed.models';

/**
 * Seconds spent on `side` (spec 05): the sum of its segments, from their stored timestamps, the
 * running one counted up to `now` (epoch ms). Never a client-side counter, so it stays right after
 * the app was closed.
 */
export function sideSeconds(feed: Feed, side: BreastSide, now: number): number {
  return feed.segments
    .filter((segment) => segment.side === side)
    .reduce((total, segment) => {
      const end = segment.endedAt ? Date.parse(segment.endedAt) : now;
      return total + Math.max(0, end - Date.parse(segment.startedAt)) / 1000;
    }, 0);
}

/** Both sides' seconds. */
export function totalSeconds(feed: Feed, now: number): number {
  return sideSeconds(feed, 'left', now) + sideSeconds(feed, 'right', now);
}

/** The side running now; null when paused or saved. */
export function runningSide(feed: Feed): BreastSide | null {
  return feed.segments.find((segment) => segment.endedAt === null)?.side ?? null;
}

/** The side of its last segment. */
export function endedOnSide(feed: Feed): BreastSide | null {
  return feed.segments.at(-1)?.side ?? null;
}

/** How long a breastfeed may stay in progress before "Still feeding?" (spec 05). */
export const STILL_FEEDING_AFTER_MS = 3 * 60 * 60 * 1000;

/** Whether `feed` is in progress and started more than 3 hours before `now` (epoch ms). */
export function isStillFeeding(feed: Feed, now: number): boolean {
  return feed.endTime === null && now - Date.parse(feed.startTime) > STILL_FEEDING_AFTER_MS;
}
