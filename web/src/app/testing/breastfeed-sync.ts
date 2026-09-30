import { signal } from '@angular/core';
import { Feed } from '../core/feeds/feed.models';

/**
 * A stand-in for `BreastfeedSyncService`: the test sets the in-progress feeds, and what the
 * component applies locally is recorded.
 */
export const fakeBreastfeedSync = (initial: readonly Feed[] = []) => {
  const inProgress = signal<readonly Feed[]>(initial);
  const puts: Feed[] = [];
  const removed: string[] = [];
  return {
    inProgress,
    puts,
    removed,
    forBaby: (babyId: string) => inProgress().find((feed) => feed.babyId === babyId) ?? null,
    put: (feed: Feed) => puts.push(feed),
    remove: (id: string) => removed.push(id),
  };
};
