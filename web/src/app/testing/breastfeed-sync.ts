import { signal } from '@angular/core';
import { Feed } from '../core/feeds/feed.models';

/**
 * A stand-in for `BreastfeedSyncService`: the test sets the in-progress feeds, and what the
 * component applies locally is recorded. `applyWaiting` records its base and runs what the test set
 * with `whenApplied` (e.g. setting the feeds as the waiting offline taps would).
 */
export const fakeBreastfeedSync = (initial: readonly Feed[] = []) => {
  const inProgress = signal<readonly Feed[]>(initial);
  const puts: Feed[] = [];
  const removed: string[] = [];
  const applied: (Feed | undefined)[] = [];
  let onApply: () => void = () => undefined;
  return {
    inProgress,
    puts,
    removed,
    forBaby: (babyId: string) => inProgress().find((feed) => feed.babyId === babyId) ?? null,
    put: (feed: Feed) => puts.push(feed),
    remove: (id: string) => removed.push(id),
    applied,
    applyWaiting: (base?: Feed) => {
      applied.push(base);
      onApply();
    },
    whenApplied: (apply: () => void) => (onApply = apply),
  };
};
