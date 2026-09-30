import { BreastFeedSegment, BreastSide, Feed } from '../core/feeds/feed.models';

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
  segments: [],
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

/** A segment of `side` from `startedAt` to `endedAt` (null: running). */
export const aSegment = (
  side: BreastSide,
  startedAt: string,
  endedAt: string | null,
  id = `s-${side}-${startedAt}`,
): BreastFeedSegment => ({ id, side, startedAt, endedAt });

/**
 * A saved breastfeed of baby b1 from 10:00 to 10:08:30: 5 min left, then 3 min 30 s right; logged by
 * Anna and never edited.
 */
export const aBreastfeed = (overrides: Partial<Feed> = {}): Feed =>
  aBottle({
    id: 'f3',
    kind: 'breastfeed',
    startTime: '2026-09-30T10:00:00Z',
    endTime: '2026-09-30T10:08:30Z',
    milkType: null,
    amountMl: null,
    segments: [
      aSegment('left', '2026-09-30T10:00:00Z', '2026-09-30T10:05:00Z'),
      aSegment('right', '2026-09-30T10:05:00Z', '2026-09-30T10:08:30Z'),
    ],
    ...overrides,
  });
