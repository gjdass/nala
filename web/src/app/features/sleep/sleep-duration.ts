import { Sleep } from '../../core/sleeps/sleep.models';

/** How long a sleep may stay live before "Still sleeping?" (spec 06). */
export const STILL_SLEEPING_AFTER_MS = 12 * 60 * 60 * 1000;

/** Whether `sleep` is live and started more than 12 hours before `now` (epoch ms). */
export function isStillSleeping(sleep: Pick<Sleep, 'startTime' | 'endTime'>, now: number): boolean {
  return sleep.endTime === null && now - Date.parse(sleep.startTime) > STILL_SLEEPING_AFTER_MS;
}
