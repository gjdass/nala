import { signal } from '@angular/core';
import { Sleep } from '../core/sleeps/sleep.models';

/** A stand-in for `SleepSyncService`: the test sets the live sleeps, and what the component applies locally is recorded. */
export const fakeSleepSync = (initial: readonly Sleep[] = []) => {
  const inProgress = signal<readonly Sleep[]>(initial);
  const puts: Sleep[] = [];
  const removed: string[] = [];
  return {
    inProgress,
    puts,
    removed,
    forBaby: (babyId: string) => inProgress().find((sleep) => sleep.babyId === babyId) ?? null,
    put: (sleep: Sleep) => puts.push(sleep),
    remove: (id: string) => removed.push(id),
    applyWaiting: () => undefined,
  };
};
