import { GrowthEntry } from '../core/growth-entries/growth-entry.models';

/** A measurement of baby b1 on Sep 28, 2026 (4250 g, 55.5 cm, head 38 cm), logged by Anna and never edited. */
export const aGrowthEntry = (overrides: Partial<GrowthEntry> = {}): GrowthEntry => ({
  id: 'g1',
  babyId: 'b1',
  kind: 'measurement',
  date: '2026-09-28',
  weightG: 4250,
  lengthCm: 55.5,
  headCircumferenceCm: 38,
  notes: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-09-28T10:00:00Z',
  updatedAt: '2026-09-28T10:00:00Z',
  ...overrides,
});
