import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

const TICK_MS = 1000;

/** Local midnight (epoch ms) of the day `time` (epoch ms) falls in. */
export function dayStartOf(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * The current time (epoch ms) as a signal, ticking every second; drives live time-since values and
 * durations. `today` is today's local midnight: it changes only when the day does, so what depends
 * only on the day (the "Today" / "Yesterday" labels) isn't worked out again every second.
 */
@Injectable({ providedIn: 'root' })
export class NowService {
  private readonly current = signal(Date.now());

  readonly now = this.current.asReadonly();
  readonly today = computed(() => dayStartOf(this.current()));

  constructor() {
    const timer = setInterval(() => this.current.set(Date.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
