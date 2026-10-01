import { Sleep } from '../../core/sleeps/sleep.models';

/**
 * A sleep's duration in whole seconds, from its start to its end, or to `now` (epoch ms) while it is
 * live; null for a live sleep without `now`.
 */
export function sleepSeconds(
  sleep: Pick<Sleep, 'startTime' | 'endTime'>,
  now?: number,
): number | null {
  const end = sleep.endTime === null ? now : Date.parse(sleep.endTime);
  return end === undefined ? null : Math.floor((end - Date.parse(sleep.startTime)) / 1000);
}

/** How long a sleep may stay live before "Still sleeping?" (spec 06). */
export const STILL_SLEEPING_AFTER_MS = 12 * 60 * 60 * 1000;

/** Whether `sleep` is live and started more than 12 hours before `now` (epoch ms). */
export function isStillSleeping(sleep: Pick<Sleep, 'startTime' | 'endTime'>, now: number): boolean {
  return sleep.endTime === null && now - Date.parse(sleep.startTime) > STILL_SLEEPING_AFTER_MS;
}
