import { aSleep } from '../../testing/sleeps';
import { QueuedRequest } from '../offline/offline-queue.models';
import { applyQueuedSleeps } from './sleep';
import { Sleep } from './sleep.models';

const ben = { id: 'u2', displayName: 'Ben' };

const request = (method: QueuedRequest['method'], url: string, body: unknown): QueuedRequest => ({
  id: `q-${method}-${url}-${JSON.stringify(body)}`,
  userId: 'u2',
  method,
  url,
  body,
  queuedAt: '2026-09-30T12:05:00.000Z',
});

const start = (id: string, at: string, babyId = 'b1') =>
  request('POST', `/api/sleeps/${id}/start`, { babyId, at, queued: true });
const stop = (id: string, at: string) => request('POST', `/api/sleeps/${id}/stop`, { at });
const edit = (id: string, body: { startTime: string; endTime: string | null; notes: string | null }) =>
  request('PUT', `/api/sleeps/${id}`, body);

const ids = (sleeps: Sleep[]) => sleeps.map((s) => s.id);

describe('applyQueuedSleeps', () => {
  const live = aSleep({ id: 'live', endTime: null, startTime: '2026-09-30T11:00:00Z' });
  const stopped = aSleep({ id: 'stopped' });

  it('creates a live sleep from a Start of a sleep the server does not have yet', () => {
    const [created] = applyQueuedSleeps([], [start('new', '2026-09-30T12:00:00.000Z')], ben);

    expect(created).toEqual({
      id: 'new',
      babyId: 'b1',
      startTime: '2026-09-30T12:00:00.000Z',
      endTime: null,
      notes: null,
      loggedBy: ben,
      updatedBy: ben,
      createdAt: '2026-09-30T12:00:00.000Z',
      updatedAt: '2026-09-30T12:00:00.000Z',
    });
  });

  it('keeps a sleep started offline next to another live sleep of the baby', () => {
    const list = applyQueuedSleeps([live], [start('new', '2026-09-30T12:00:00.000Z')], ben);

    expect(ids(list)).toEqual(['live', 'new']);
  });

  it('leaves a live sleep as it is on a Start', () => {
    expect(applyQueuedSleeps([live], [start('live', '2026-09-30T12:00:00.000Z')], ben)).toEqual([
      live,
    ]);
  });

  it('makes a stopped sleep live again on a Start, from its own start time', () => {
    const [again] = applyQueuedSleeps([stopped], [start('stopped', '2026-09-30T12:00:00.000Z')], ben);

    expect(again).toMatchObject({
      id: 'stopped',
      startTime: stopped.startTime,
      endTime: null,
      updatedBy: ben,
    });
  });

  it('ignores a Start before the start time of the stopped sleep', () => {
    expect(
      applyQueuedSleeps([stopped], [start('stopped', '2026-09-30T09:00:00.000Z')], ben),
    ).toEqual([]);
  });

  it('ends a live sleep on a Stop: no longer live', () => {
    expect(applyQueuedSleeps([live], [stop('live', '2026-09-30T12:00:00.000Z')], ben)).toEqual([]);
  });

  it('ignores a Stop before the start, or of a sleep it does not have', () => {
    const list = applyQueuedSleeps(
      [live],
      [stop('live', '2026-09-30T10:00:00.000Z'), stop('unknown', '2026-09-30T12:00:00.000Z')],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('runs again from the original start after Start, Stop and Start offline', () => {
    const list = applyQueuedSleeps(
      [],
      [
        start('new', '2026-09-30T12:00:00.000Z'),
        stop('new', '2026-09-30T12:10:00.000Z'),
        start('new', '2026-09-30T12:20:00.000Z'),
      ],
      ben,
    );

    expect(list).toMatchObject([{ id: 'new', startTime: '2026-09-30T12:00:00.000Z', endTime: null }]);
  });

  it('applies an edit to the start time and notes of a live sleep', () => {
    const [edited] = applyQueuedSleeps(
      [live],
      [edit('live', { startTime: '2026-09-30T10:45:00.000Z', endTime: null, notes: '  calm ' })],
      ben,
    );

    expect(edited).toMatchObject({
      startTime: '2026-09-30T10:45:00.000Z',
      endTime: null,
      notes: 'calm',
      updatedBy: ben,
      updatedAt: '2026-09-30T12:05:00.000Z',
    });
  });

  it('ignores an edit with an end time on a live sleep (the server refuses it)', () => {
    const list = applyQueuedSleeps(
      [live],
      [edit('live', { startTime: live.startTime, endTime: '2026-09-30T12:00:00.000Z', notes: null })],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('removes a deleted sleep', () => {
    expect(applyQueuedSleeps([live], [request('DELETE', '/api/sleeps/live', null)], ben)).toEqual(
      [],
    );
  });

  it('ignores other requests', () => {
    const list = applyQueuedSleeps(
      [live],
      [
        request('POST', '/api/sleeps', { id: 'typed', babyId: 'b1' }),
        request('DELETE', '/api/feeds/live', null),
        request('POST', '/api/feeds/x/breastfeed/start', { babyId: 'b1', at: live.startTime }),
      ],
      ben,
    );

    expect(list).toEqual([live]);
  });

  it('is harmless when the same requests are applied again', () => {
    const waiting = [start('new', '2026-09-30T12:00:00.000Z')];
    const once = applyQueuedSleeps([live], waiting, ben);

    expect(applyQueuedSleeps(once, waiting, ben)).toEqual(once);
  });
});
