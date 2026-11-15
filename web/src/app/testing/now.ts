import { WritableSignal, computed } from '@angular/core';
import { NowService, dayStartOf } from '../core/time/now.service';

/** A `NowService` driven by `now`, with its `today` following it like the real one. */
export function fakeNow(now: WritableSignal<number>): Pick<NowService, 'now' | 'today'> {
  return { now, today: computed(() => dayStartOf(now())) };
}
