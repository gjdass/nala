import { Sleep } from '../../core/sleeps/sleep.models';

/** A sleep's duration in whole seconds, from its start to its end; null while it is live. */
export function sleepSeconds(sleep: Pick<Sleep, 'startTime' | 'endTime'>): number | null {
  return sleep.endTime === null
    ? null
    : Math.floor((Date.parse(sleep.endTime) - Date.parse(sleep.startTime)) / 1000);
}
