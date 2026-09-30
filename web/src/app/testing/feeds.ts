import { Feed } from '../core/feeds/feed.models';

/** A formula bottle of 120 ml for baby b1, logged by Anna and never edited. */
export const aBottle = (overrides: Partial<Feed> = {}): Feed => ({
  id: 'f1',
  babyId: 'b1',
  kind: 'bottle',
  startTime: '2026-09-30T10:00:00Z',
  endTime: null,
  notes: null,
  milkType: 'formula',
  amountMl: 120,
  mealType: null,
  food: null,
  reaction: null,
  loggedBy: { id: 'u1', displayName: 'Anna' },
  updatedBy: { id: 'u1', displayName: 'Anna' },
  createdAt: '2026-09-30T10:00:00Z',
  updatedAt: '2026-09-30T10:00:00Z',
  ...overrides,
});

/** Carrot purée for lunch that baby b1 liked, logged by Anna and never edited. */
export const aSolids = (overrides: Partial<Feed> = {}): Feed =>
  aBottle({
    id: 'f2',
    kind: 'solids',
    startTime: '2026-09-30T12:00:00Z',
    milkType: null,
    amountMl: null,
    mealType: 'lunch',
    food: 'Carrot purée',
    reaction: 'liked',
    createdAt: '2026-09-30T12:00:00Z',
    updatedAt: '2026-09-30T12:00:00Z',
    ...overrides,
  });
