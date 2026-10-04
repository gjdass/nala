import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { applyQueuedTimedEntries } from '../timers/queued-timed-entries';
import { Sleep } from './sleep.models';

/**
 * The live sleeps once the user's changes waiting on the device are applied, by the server's rules
 * (spec 06), on the shared `applyQueuedTimedEntries`: an edit sets the notes.
 */
export function applyQueuedSleeps(
  sleeps: readonly Sleep[],
  requests: readonly QueuedRequest[],
  user: UserName,
): Sleep[] {
  return applyQueuedTimedEntries(sleeps, requests, user, {
    path: 'sleeps',
    blank: { notes: null },
    edited: (body) => ({ notes: (body as Pick<Sleep, 'notes'>).notes?.trim() || null }),
  });
}
