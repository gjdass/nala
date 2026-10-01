import { Feed } from '../core/feeds/feed.models';
import { fakeLiveSync } from './live-sync';

/** A stand-in for `BreastfeedSyncService` (see `fakeLiveSync`). */
export const fakeBreastfeedSync = (initial: readonly Feed[] = []) => fakeLiveSync<Feed>(initial);
