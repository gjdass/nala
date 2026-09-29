import { InjectionToken, Signal } from '@angular/core';
import { SectionKey } from '../sections/section.models';

/** A timer running now (spec 04 mini-bar), e.g. an in-progress breastfeed. */
export interface RunningTimer {
  /** Unique across every source. */
  id: string;
  section: SectionKey;
  /** Kind key of the entry: tapping the timer opens its sheet with `entry`. */
  kind: string;
  /** The in-progress entry its sheet opens pre-filled with. */
  entry: unknown;
  babyId: string;
  /** Translation key of its label (e.g. "Feeding · L"). */
  label: string;
  labelParams?: Record<string, unknown>;
  /** Its live duration in seconds at `now` (epoch ms). */
  seconds: (now: number) => number;
}

/** A section's running timers; each feature with timers registers one through `RUNNING_TIMER_SOURCES`. */
export interface RunningTimerSource {
  readonly timers: Signal<readonly RunningTimer[]>;
}

/** Every registered running-timer source, merged by `RunningTimersService`. */
export const RUNNING_TIMER_SOURCES = new InjectionToken<readonly RunningTimerSource[]>(
  'RUNNING_TIMER_SOURCES',
  { providedIn: 'root', factory: () => [] },
);
