import { Sleep } from '../../core/sleeps/sleep.models';
import { isLiveLongerThan } from '../../core/time/live-longer-than';

/** How long a sleep may stay live before "Still sleeping?" (spec 06). */
export const STILL_SLEEPING_AFTER_MS = 12 * 60 * 60 * 1000;

/** Whether `sleep` is live and started more than 12 hours before `now` (epoch ms). */
export function isStillSleeping(sleep: Pick<Sleep, 'startTime' | 'endTime'>, now: number): boolean {
  return isLiveLongerThan(sleep, STILL_SLEEPING_AFTER_MS, now);
}
