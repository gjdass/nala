import { signal } from '@angular/core';
import { LiveEntry } from '../core/timers/live-entries-sync';

/**
 * A stand-in for a `LiveEntriesSync`: the test sets the live entries, and what the component
 * applies locally is recorded. `applyWaiting` records its base and runs what the test set with
 * `whenApplied` (e.g. setting the entries as the waiting offline taps would).
 */
export const fakeLiveSync = <T extends LiveEntry>(initial: readonly T[] = []) => {
  const inProgress = signal<readonly T[]>(initial);
  const puts: T[] = [];
  const removed: string[] = [];
  const applied: (T | undefined)[] = [];
  let onApply: () => void = () => undefined;
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
  };
};
