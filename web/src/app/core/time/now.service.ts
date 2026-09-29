import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const TICK_MS = 1000;

/** The current time (epoch ms) as a signal, ticking every second; drives live time-since values and durations. */
@Injectable({ providedIn: 'root' })
export class NowService {
  private readonly current = signal(Date.now());

  readonly now = this.current.asReadonly();

  constructor() {
    const timer = setInterval(() => this.current.set(Date.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
