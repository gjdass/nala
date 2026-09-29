import { signal } from '@angular/core';
import { RunningTimer, RunningTimerSource } from '../core/timers/running-timer.models';

/** A running timer started at `startedAt` (epoch ms), labelled with an existing translation key. */
export const fakeTimer = (overrides: Partial<RunningTimer> & { startedAt?: number } = {}): RunningTimer => {
  const { startedAt = 0, ...timer } = overrides;
  return {
    id: 'timer-1',
    section: 'feed',
    kind: 'only',
    entry: { id: 'entry-1' },
    babyId: 'baby-1',
    label: 'sections.feed',
    seconds: (now) => (now - startedAt) / 1000,
    ...timer,
  };
};

/** A timer source whose timers the test sets. */
export const fakeTimerSource = (timers: readonly RunningTimer[] = []) => {
  const current = signal<readonly RunningTimer[]>(timers);
  const source: RunningTimerSource = { timers: current.asReadonly() };
  return { source, set: (next: readonly RunningTimer[]) => current.set(next) };
};
