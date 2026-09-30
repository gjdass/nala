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
