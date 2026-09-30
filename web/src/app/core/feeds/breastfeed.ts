import { QueuedRequest } from '../offline/offline-queue.models';
import { BreastFeedSegment, BreastSide, Feed, UserName } from './feed.models';

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

const TIMER_URL = /^\/api\/feeds\/([^/]+)\/breastfeed\/(start|stop|finish)$/;
const FEED_URL = /^\/api\/feeds\/([^/]+)$/;

interface StartBody {
  babyId: string;
  segmentId: string;
  side: BreastSide;
  at: string;
}

interface TimerBody {
  at: string;
  startTime?: string;
  notes?: string | null;
}

/**
 * The breastfeeds in progress once `requests` (the user's changes waiting on the device, oldest first)
 * are applied to `feeds`, following the server's rules (spec 05): a start creates the feed (start time
 * = its time) or reopens it and stops the other side, a stop pauses, a finish, a delete or durations
 * typed by hand end it. A tap the feed already has (same segment, side already running, or a time
 * before its latest segment) changes nothing, so applying the same requests again is harmless. A
 * feed created here is logged by `user`. Only the feeds still in progress are returned.
 */
export function applyQueued(
  feeds: readonly Feed[],
  requests: readonly QueuedRequest[],
  user: UserName,
): Feed[] {
  let list = [...feeds];
  const replace = (feed: Feed) =>
    (list = list.some((f) => f.id === feed.id)
      ? list.map((f) => (f.id === feed.id ? feed : f))
      : [...list, feed]);
  for (const request of requests) {
    const timer = request.method === 'POST' ? TIMER_URL.exec(request.url) : null;
    if (timer) {
      const [, id, action] = timer;
      const feed = list.find((f) => f.id === id);
      if (action === 'start') {
        replace(start(feed, id, request.body as StartBody, user));
      } else if (feed) {
        const body = request.body as TimerBody;
        replace(action === 'stop' ? stop(feed, body, user) : finish(feed, body, user));
      }
      continue;
    }
    const entry = FEED_URL.exec(request.url);
    const ends =
      request.method === 'DELETE' ||
      (request.method === 'PUT' && !!(request.body as { durations?: unknown })?.durations);
    if (entry && ends) {
      list = list.filter((f) => f.id !== entry[1]);
    }
  }
  return list.filter((feed) => feed.endTime === null);
}

function start(feed: Feed | undefined, id: string, body: StartBody, user: UserName): Feed {
  if (
    feed &&
    (feed.segments.some((s) => s.id === body.segmentId) ||
      (feed.endTime === null && runningSide(feed) === body.side) ||
      Date.parse(body.at) < latestSegmentTime(feed))
  ) {
    return feed;
  }
  const base: Feed = feed ?? {
    id,
    babyId: body.babyId,
    kind: 'breastfeed',
    startTime: body.at,
    endTime: null,
    notes: null,
    milkType: null,
    amountMl: null,
    mealType: null,
    food: null,
    reaction: null,
    segments: [],
    loggedBy: user,
    updatedBy: user,
    createdAt: body.at,
    updatedAt: body.at,
  };
  return {
    ...base,
    endTime: null,
    segments: [
      ...closeOpen(base.segments, body.at),
      { id: body.segmentId, side: body.side, startedAt: body.at, endedAt: null },
    ],
    updatedBy: user,
    updatedAt: body.at,
  };
}

function stop(feed: Feed, body: TimerBody, user: UserName): Feed {
  const open = feed.segments.find((s) => s.endedAt === null);
  if (!open || Date.parse(body.at) < Date.parse(open.startedAt)) {
    return feed;
  }
  return {
    ...feed,
    segments: closeOpen(feed.segments, body.at),
    updatedBy: user,
    updatedAt: body.at,
  };
}

function finish(feed: Feed, body: TimerBody, user: UserName): Feed {
  if (feed.endTime !== null) {
    return feed;
  }
  return {
    ...feed,
    startTime: body.startTime ?? feed.startTime,
    notes: body.notes?.trim() || null,
    endTime: body.at,
    segments: closeOpen(feed.segments, body.at),
    updatedBy: user,
    updatedAt: body.at,
  };
}

function closeOpen(segments: readonly BreastFeedSegment[], at: string): BreastFeedSegment[] {
  return segments.map((s) => (s.endedAt === null ? { ...s, endedAt: at } : s));
}

/** The latest start or end of its segments, in epoch ms. */
function latestSegmentTime(feed: Feed): number {
  return Math.max(-Infinity, ...feed.segments.map((s) => Date.parse(s.endedAt ?? s.startedAt)));
}
