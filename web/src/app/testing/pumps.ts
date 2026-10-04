import { Pump } from '../core/pumps/pump.models';

/** A pumping session of baby b1 from 10:00 to 10:20 UTC, 90 ml left and 80 ml right, logged by Anna and never edited. */
export const aPump = (overrides: Partial<Pump> = {}): Pump => ({
  id: 'p1',
  babyId: 'b1',
  startTime: '2026-10-03T10:00:00Z',
  endTime: '2026-10-03T10:20:00Z',
  leftMl: 90,
  rightMl: 80,
  notes: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-10-03T10:20:00Z',
  updatedAt: '2026-10-03T10:20:00Z',
  ...overrides,
});
