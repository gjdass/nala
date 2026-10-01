import { Sleep } from '../core/sleeps/sleep.models';

/** A sleep of baby b1 from 10:00 to 11:30 UTC, logged by Anna and never edited. */
export const aSleep = (overrides: Partial<Sleep> = {}): Sleep => ({
  id: 's1',
  babyId: 'b1',
  startTime: '2026-09-30T10:00:00Z',
  endTime: '2026-09-30T11:30:00Z',
  notes: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-09-30T11:30:00Z',
  updatedAt: '2026-09-30T11:30:00Z',
  ...overrides,
});
