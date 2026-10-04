import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { applyQueuedTimedEntries } from '../timers/queued-timed-entries';
import { Pump, PumpFields } from './pump.models';

/** Left + right in ml, a side without a volume counting as 0; null when neither side has one (spec 08). */
export function pumpTotalMl({ leftMl, rightMl }: Pick<Pump, 'leftMl' | 'rightMl'>): number | null {
  return leftMl === null && rightMl === null ? null : (leftMl ?? 0) + (rightMl ?? 0);
}

/**
 * The live pumping sessions once the user's changes waiting on the device are applied, by the
 * server's rules (spec 08), on the shared `applyQueuedTimedEntries`: an edit sets the volumes and notes.
 */
export function applyQueuedPumps(
  pumps: readonly Pump[],
  requests: readonly QueuedRequest[],
  user: UserName,
): Pump[] {
  return applyQueuedTimedEntries(pumps, requests, user, {
    path: 'pumps',
    blank: { leftMl: null, rightMl: null, notes: null },
    edited: (body) => {
      const { leftMl, rightMl, notes } = body as PumpFields;
      return { leftMl, rightMl, notes: notes?.trim() || null };
    },
  });
}
