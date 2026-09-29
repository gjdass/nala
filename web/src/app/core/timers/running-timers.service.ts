import { Injectable, computed, inject } from '@angular/core';
import { RUNNING_TIMER_SOURCES } from './running-timer.models';

/** Every timer running now, merged from the registered sources in their order (spec 04 mini-bar). */
@Injectable({ providedIn: 'root' })
export class RunningTimersService {
  private readonly sources = inject(RUNNING_TIMER_SOURCES);

  readonly timers = computed(() => this.sources.flatMap((source) => source.timers()));
}
