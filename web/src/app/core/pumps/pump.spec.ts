import { aPump } from '../../testing/pumps';
import { QueuedRequest } from '../offline/offline-queue.models';
import { applyQueuedPumps, pumpTotalMl } from './pump';
import { Pump } from './pump.models';

describe('pumpTotalMl', () => {
  it('adds both sides', () => {
    expect(pumpTotalMl(aPump({ leftMl: 90, rightMl: 80 }))).toBe(170);
  });

  it('counts a side without a volume as 0', () => {
    expect(pumpTotalMl(aPump({ leftMl: 90, rightMl: null }))).toBe(90);
    expect(pumpTotalMl(aPump({ leftMl: null, rightMl: 0 }))).toBe(0);
  });

  it('is null when neither side has a volume', () => {
    expect(pumpTotalMl(aPump({ leftMl: null, rightMl: null }))).toBeNull();
  });
});

const ben = { id: 'u2', displayName: 'Ben' };

const request = (method: QueuedRequest['method'], url: string, body: unknown): QueuedRequest => ({
  id: `q-${method}-${url}-${JSON.stringify(body)}`,
  userId: 'u2',
  method,
  url,
  body,
  queuedAt: '2026-10-03T12:05:00.000Z',
});

const start = (id: string, at: string, babyId = 'b1') =>
  request('POST', `/api/pumps/${id}/start`, { babyId, at, queued: true });
const stop = (id: string, at: string) => request('POST', `/api/pumps/${id}/stop`, { at });
const edit = (
  id: string,
  body: {
    startTime: string;
    endTime: string | null;
    leftMl: number | null;
    rightMl: number | null;
    notes: string | null;
  },
) => request('PUT', `/api/pumps/${id}`, body);

const ids = (pumps: Pump[]) => pumps.map((p) => p.id);

describe('applyQueuedPumps', () => {
  const live = aPump({ id: 'live', endTime: null, startTime: '2026-10-03T11:00:00Z' });
  const stopped = aPump({ id: 'stopped' });

  it('creates a live session from a Start of a session the server does not have yet', () => {
    const [created] = applyQueuedPumps([], [start('new', '2026-10-03T12:00:00.000Z')], ben);

    expect(created).toEqual({
      id: 'new',
      babyId: 'b1',
      startTime: '2026-10-03T12:00:00.000Z',
      endTime: null,
      leftMl: null,
      rightMl: null,
      notes: null,
      loggedBy: ben,
      updatedBy: ben,
      createdAt: '2026-10-03T12:00:00.000Z',
      updatedAt: '2026-10-03T12:00:00.000Z',
    });
  });

  it('keeps a session started offline next to another live session of the baby', () => {
    const list = applyQueuedPumps([live], [start('new', '2026-10-03T12:00:00.000Z')], ben);

    expect(ids(list)).toEqual(['live', 'new']);
  });

  it('leaves a live session as it is on a Start', () => {
    expect(applyQueuedPumps([live], [start('live', '2026-10-03T12:00:00.000Z')], ben)).toEqual([
      live,
    ]);
  });

  it('makes a stopped session live again on a Start, from its own start time', () => {
    const [again] = applyQueuedPumps([stopped], [start('stopped', '2026-10-03T12:00:00.000Z')], ben);

    expect(again).toMatchObject({
      id: 'stopped',
      startTime: stopped.startTime,
      endTime: null,
      leftMl: 90,
      rightMl: 80,
      updatedBy: ben,
    });
  });

  it('ignores a Start before the start time of the stopped session', () => {
    expect(
      applyQueuedPumps([stopped], [start('stopped', '2026-10-03T09:00:00.000Z')], ben),
    ).toEqual([]);
  });

  it('ends a live session on a Stop: no longer live', () => {
    expect(applyQueuedPumps([live], [stop('live', '2026-10-03T12:00:00.000Z')], ben)).toEqual([]);
  });

  it('ignores a Stop before the start, or of a session it does not have', () => {
    const list = applyQueuedPumps(
      [live],
      [stop('live', '2026-10-03T10:00:00.000Z'), stop('unknown', '2026-10-03T12:00:00.000Z')],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('runs again from the original start after Start, Stop and Start offline', () => {
    const list = applyQueuedPumps(
      [],
      [
        start('new', '2026-10-03T12:00:00.000Z'),
        stop('new', '2026-10-03T12:10:00.000Z'),
        start('new', '2026-10-03T12:20:00.000Z'),
      ],
      ben,
    );

    expect(list).toMatchObject([{ id: 'new', startTime: '2026-10-03T12:00:00.000Z', endTime: null }]);
  });

  it('applies an edit to the start time, volumes and notes of a live session', () => {
    const [edited] = applyQueuedPumps(
      [live],
      [
        edit('live', {
          startTime: '2026-10-03T10:45:00.000Z',
          endTime: null,
          leftMl: 60,
          rightMl: null,
          notes: '  evening ',
        }),
      ],
      ben,
    );

    expect(edited).toMatchObject({
      startTime: '2026-10-03T10:45:00.000Z',
      endTime: null,
      leftMl: 60,
      rightMl: null,
      notes: 'evening',
      updatedBy: ben,
      updatedAt: '2026-10-03T12:05:00.000Z',
    });
  });

  it('ignores an edit with an end time on a live session (the server refuses it)', () => {
    const list = applyQueuedPumps(
      [live],
      [
        edit('live', {
          startTime: live.startTime,
          endTime: '2026-10-03T12:00:00.000Z',
          leftMl: 60,
          rightMl: 60,
          notes: null,
        }),
      ],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('removes a deleted session', () => {
    expect(applyQueuedPumps([live], [request('DELETE', '/api/pumps/live', null)], ben)).toEqual([]);
  });

  it('ignores other requests', () => {
    const list = applyQueuedPumps(
      [live],
      [
        request('POST', '/api/pumps', { id: 'typed', babyId: 'b1' }),
        request('DELETE', '/api/sleeps/live', null),
        request('POST', '/api/sleeps/x/start', { babyId: 'b1', at: live.startTime }),
      ],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('is harmless when the same requests are applied again', () => {
    const waiting = [start('new', '2026-10-03T12:00:00.000Z')];
    const once = applyQueuedPumps([live], waiting, ben);

    expect(applyQueuedPumps(once, waiting, ben)).toEqual(once);
  });
});
