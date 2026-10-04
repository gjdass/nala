import { Diaper } from '../core/diapers/diaper.models';

/** A wet diaper of baby b1 at 10:00 UTC, logged by Anna and never edited. */
export const aDiaper = (overrides: Partial<Diaper> = {}): Diaper => ({
  id: 'd1',
  babyId: 'b1',
  time: '2026-10-03T10:00:00Z',
  wet: true,
  dirty: false,
  rash: false,
  color: null,
  consistency: null,
  notes: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-10-03T10:00:00Z',
  updatedAt: '2026-10-03T10:00:00Z',
  ...overrides,
});
