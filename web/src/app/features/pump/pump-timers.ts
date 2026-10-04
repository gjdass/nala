import { EnvironmentProviders, Injectable, computed, inject } from '@angular/core';
import { Pump } from '../../core/pumps/pump.models';
import { PumpSyncService } from '../../core/pumps/pump-sync.service';
import { spanSeconds } from '../../core/time/span-seconds';
import {
  RunningTimer,
  RunningTimerSource,
  provideRunningTimerSource,
} from '../../core/timers/running-timer.models';

/**
 * The Pump section's running timers for the mini-bar (spec 08): one per live session, of every baby,
 * "Pumping" with its live duration from the stored start time. A stopped session has none.
 */
@Injectable({ providedIn: 'root' })
export class PumpTimerSource implements RunningTimerSource {
  private readonly sync = inject(PumpSyncService);

  readonly timers = computed(() =>
    this.sync
      .inProgress()
      .filter((pump) => pump.endTime === null)
      .map(toTimer),
  );
}

function toTimer(pump: Pump): RunningTimer {
  return {
    id: `pump-${pump.id}`,
    section: 'pump',
    kind: 'pump',
    entry: pump,
    babyId: pump.babyId,
    label: 'pump.timer.pumping',
    seconds: (now) => spanSeconds(pump, now) ?? 0,
  };
}

/** Registers the Pump section's running timers with the mini-bar. */
export function providePumpTimers(): EnvironmentProviders {
  return provideRunningTimerSource(PumpTimerSource);
}
