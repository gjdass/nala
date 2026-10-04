import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { LiveEntry } from '../core/timers/live-entries-sync';

/**
 * A stand-in for a `LiveEntriesSync`: the test sets the live entries, and what the component
 * applies locally is recorded. `applyWaiting` records its base and runs what the test set with
 * `whenApplied` (e.g. setting the entries as the waiting offline taps would). `refresh` is counted
 * by `refreshes()`; `refreshed.next()` answers it.
 */
export const fakeLiveSync = <T extends LiveEntry>(initial: readonly T[] = []) => {
  const inProgress = signal<readonly T[]>(initial);
  const puts: T[] = [];
  const removed: string[] = [];
  const applied: (T | undefined)[] = [];
  let onApply: () => void = () => undefined;
  let refreshes = 0;
  const refreshed = new Subject<void>();
  return {
    inProgress,
    puts,
    removed,
    forBaby: (babyId: string) => inProgress().find((entry) => entry.babyId === babyId) ?? null,
    put: (entry: T) => puts.push(entry),
    remove: (id: string) => removed.push(id),
    applied,
    applyWaiting: (base?: T) => {
      applied.push(base);
      onApply();
    },
    whenApplied: (apply: () => void) => (onApply = apply),
    refresh: () => {
      refreshes++;
      return refreshed.asObservable();
    },
    refreshes: () => refreshes,
    refreshed,
  };
};
