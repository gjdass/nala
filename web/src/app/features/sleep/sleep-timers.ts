import { EnvironmentProviders, Injectable, computed, inject } from '@angular/core';
import { Sleep } from '../../core/sleeps/sleep.models';
import { SleepSyncService } from '../../core/sleeps/sleep-sync.service';
import {
  RunningTimer,
  RunningTimerSource,
  provideRunningTimerSource,
} from '../../core/timers/running-timer.models';
import { sleepSeconds } from './sleep-duration';

/**
 * The Sleep section's running timers for the mini-bar (spec 06): one per live sleep, of every baby,
 * "Sleeping" with its live duration from the stored start time. A stopped sleep has none.
 */
@Injectable({ providedIn: 'root' })
export class SleepTimerSource implements RunningTimerSource {
  private readonly sync = inject(SleepSyncService);

  readonly timers = computed(() =>
    this.sync
      .inProgress()
      .filter((sleep) => sleep.endTime === null)
      .map(toTimer),
  );
}

function toTimer(sleep: Sleep): RunningTimer {
  return {
    id: `sleep-${sleep.id}`,
    section: 'sleep',
    kind: 'sleep',
    entry: sleep,
    babyId: sleep.babyId,
    label: 'sleep.timer.sleeping',
    seconds: (now) => sleepSeconds(sleep, now) ?? 0,
  };
}

/** Registers the Sleep section's running timers with the mini-bar. */
export function provideSleepTimers(): EnvironmentProviders {
  return provideRunningTimerSource(SleepTimerSource);
}
