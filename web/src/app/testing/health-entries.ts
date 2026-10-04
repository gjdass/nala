import { HealthEntry } from '../core/health-entries/health-entry.models';

/** 2.5 ml of Paracetamol for baby b1 at 10:00 UTC, logged by Anna and never edited. */
export const aHealthEntry = (overrides: Partial<HealthEntry> = {}): HealthEntry => ({
  id: 'm1',
  babyId: 'b1',
  time: '2026-10-03T10:00:00Z',
  name: 'Paracetamol',
  amount: 2.5,
  unit: 'ml',
  notes: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-10-03T10:00:00Z',
  updatedAt: '2026-10-03T10:00:00Z',
  ...overrides,
});
