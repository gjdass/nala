import { aPump } from '../../testing/pumps';
import { aSleep } from '../../testing/sleeps';
import { stoppedEntry } from './stopped-entry';

const ben = { id: 'u2', displayName: 'Ben' };

describe('stoppedEntry', () => {
  const live = aSleep({ endTime: null, startTime: '2026-09-30T11:00:00Z' });

  it('ends a live entry at the given time, keeping its other fields', () => {
    expect(stoppedEntry(live, '2026-09-30T12:00:00.000Z', ben)).toEqual({
      ...live,
      endTime: '2026-09-30T12:00:00.000Z',
      updatedBy: ben,
      updatedAt: '2026-09-30T12:00:00.000Z',
    });
    const pump = aPump({ endTime: null, startTime: '2026-10-03T10:00:00Z' });
    expect(stoppedEntry(pump, '2026-10-03T10:20:00.000Z')).toMatchObject({
      leftMl: 90,
      endTime: '2026-10-03T10:20:00.000Z',
      updatedBy: pump.updatedBy,
    });
  });

  it('leaves a stopped entry, or a time before the start, alone', () => {
    const stopped = aSleep();

    expect(stoppedEntry(stopped, '2026-09-30T12:00:00.000Z', ben)).toBe(stopped);
    expect(stoppedEntry(live, '2026-09-30T10:00:00.000Z', ben)).toBe(live);
  });
});
