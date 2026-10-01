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
