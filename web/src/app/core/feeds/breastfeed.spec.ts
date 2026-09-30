import { aBreastfeed, aSegment } from '../../testing/feeds';
import { QueuedRequest } from '../offline/offline-queue.models';
import {
  applyQueued,
  endedOnSide,
  isStillFeeding,
  runningSide,
  sideSeconds,
  totalSeconds,
} from './breastfeed';
import { Feed } from './feed.models';

const at = (time: string) => new Date(`2026-09-30T${time}Z`).getTime();

describe('breastfeed durations', () => {
  const inProgress = aBreastfeed({
    endTime: null,
    segments: [
      aSegment('left', '2026-09-30T10:00:00Z', '2026-09-30T10:05:00Z'),
      aSegment('right', '2026-09-30T10:05:00Z', '2026-09-30T10:07:00Z'),
      aSegment('left', '2026-09-30T10:07:00Z', null),
    ],
  });

  it('sums the segments of each side, from their stored timestamps', () => {
    const feed = aBreastfeed();

    expect(sideSeconds(feed, 'left', at('11:00:00'))).toBe(300);
    expect(sideSeconds(feed, 'right', at('11:00:00'))).toBe(210);
    expect(totalSeconds(feed, at('11:00:00'))).toBe(510);
  });

  it('counts the running segment up to now', () => {
    expect(sideSeconds(inProgress, 'left', at('10:10:30'))).toBe(300 + 210);
    expect(sideSeconds(inProgress, 'right', at('10:10:30'))).toBe(120);
  });

  it('knows the running side, none once paused or saved', () => {
    expect(runningSide(inProgress)).toBe('left');
    expect(runningSide(aBreastfeed())).toBeNull();
  });

  it('ended on the side of the last segment', () => {
    expect(endedOnSide(aBreastfeed())).toBe('right');
    expect(endedOnSide(inProgress)).toBe('left');
    expect(endedOnSide(aBreastfeed({ segments: [] }))).toBeNull();
  });

  it('is zero without segments', () => {
    const empty = aBreastfeed({ segments: [] });

    expect(totalSeconds(empty, at('11:00:00'))).toBe(0);
    expect(runningSide(empty)).toBeNull();
  });
});

describe('isStillFeeding', () => {
  const started = aBreastfeed({ startTime: '2026-09-30T10:00:00Z', endTime: null });

  it('is true once a feed in progress started more than 3 hours ago', () => {
    expect(isStillFeeding(started, at('13:00:01'))).toBe(true);
  });

  it('is false up to 3 hours', () => {
    expect(isStillFeeding(started, at('13:00:00'))).toBe(false);
    expect(isStillFeeding(started, at('10:30:00'))).toBe(false);
  });

  it('is false for a saved feed', () => {
    expect(isStillFeeding(aBreastfeed(), at('20:00:00'))).toBe(false);
  });
});

describe('applyQueued', () => {
  const ben = { id: 'u2', displayName: 'Ben' };
  const iso = (time: string) => `2026-09-30T${time}.000Z`;
  let n = 0;
  const request = (method: QueuedRequest['method'], url: string, body: unknown): QueuedRequest => ({
    id: `q${++n}`,
    userId: 'u2',
    method,
    url,
    body,
    queuedAt: iso('12:00:00'),
  });
  const start = (id: string, side: 'left' | 'right', time: string, segmentId = `seg-${time}`) =>
    request('POST', `/api/feeds/${id}/breastfeed/start`, {
      babyId: 'b1',
      segmentId,
      side,
      at: iso(time),
      queued: true,
    });
  const stop = (id: string, time: string) =>
    request('POST', `/api/feeds/${id}/breastfeed/stop`, { at: iso(time) });
  const finish = (id: string, time: string) =>
    request('POST', `/api/feeds/${id}/breastfeed/finish`, {
      startTime: iso('11:00:00'),
      notes: 'calm',
      at: iso(time),
    });
  const sides = (feed: Feed) => feed.segments.map((s) => [s.side, s.startedAt, s.endedAt] as const);

  it('creates the breastfeed in progress from a queued start, as the server would', () => {
    const [feed] = applyQueued([], [start('new', 'left', '11:00:00')], ben);

    expect(feed).toMatchObject({
      id: 'new',
      babyId: 'b1',
      kind: 'breastfeed',
      startTime: iso('11:00:00'),
      endTime: null,
      loggedBy: ben,
      updatedBy: ben,
      updatedAt: iso('11:00:00'),
    });
    expect(sides(feed)).toEqual([['left', iso('11:00:00'), null]]);
  });

  it('switches sides and pauses in order', () => {
    const [feed] = applyQueued(
      [],
      [
        start('new', 'left', '11:00:00'),
        start('new', 'right', '11:05:00'),
        stop('new', '11:07:00'),
      ],
      ben,
    );

    expect(sides(feed)).toEqual([
      ['left', iso('11:00:00'), iso('11:05:00')],
      ['right', iso('11:05:00'), iso('11:07:00')],
    ]);
    expect(runningSide(feed)).toBeNull();
  });

  it('applies queued taps on top of the feed the server knows', () => {
    const known = aBreastfeed({
      id: 'f3',
      endTime: null,
      segments: [aSegment('left', iso('10:00:00'), null)],
    });

    const [feed] = applyQueued([known], [start('f3', 'right', '10:04:00')], ben);

    expect(sides(feed)).toEqual([
      ['left', iso('10:00:00'), iso('10:04:00')],
      ['right', iso('10:04:00'), null],
    ]);
    expect(feed.loggedBy).toEqual(known.loggedBy);
    expect(feed.updatedBy).toEqual(ben);
  });

  it('changes nothing for a tap the feed already has (re-applied or already sent)', () => {
    const queue = [start('new', 'left', '11:00:00'), stop('new', '11:03:00')];
    const once = applyQueued([], queue, ben);

    expect(applyQueued(once, queue, ben)).toEqual(once);
    expect(applyQueued(once, [start('new', 'left', '11:00:00', 'other')], ben)).toEqual(once);
  });

  it('drops a feed once finished, deleted or saved with typed durations', () => {
    const known = aBreastfeed({
      id: 'f3',
      endTime: null,
      segments: [aSegment('left', iso('10:00:00'), null)],
    });
    const other = aBreastfeed({ id: 'f4', babyId: 'b2', endTime: null, segments: [] });
    const typed = aBreastfeed({ id: 'f5', babyId: 'b3', endTime: null, segments: [] });

    expect(
      applyQueued(
        [known, other, typed],
        [
          finish('f3', '10:09:00'),
          request('DELETE', '/api/feeds/f4', null),
          request('PUT', '/api/feeds/f5', {
            startTime: iso('10:00:00'),
            notes: null,
            durations: { leftSeconds: 60, rightSeconds: 0, endedOn: 'left' },
          }),
        ],
        ben,
      ),
    ).toEqual([]);
  });

  it('reopens a saved feed it is given', () => {
    const [feed] = applyQueued([aBreastfeed()], [start('f3', 'left', '11:00:00')], ben);

    expect(feed.endTime).toBeNull();
    expect(feed.segments).toHaveLength(3);
    expect(runningSide(feed)).toBe('left');
  });

  it('leaves out saved feeds and ignores the other requests', () => {
    const list = applyQueued(
      [aBreastfeed()],
      [
        request('POST', '/api/feeds', { id: 'b', kind: 'bottle' }),
        request('PUT', '/api/feeds/f3', { startTime: iso('10:00:00'), notes: 'x' }),
      ],
      ben,
    );

    expect(list).toEqual([]);
  });
});
