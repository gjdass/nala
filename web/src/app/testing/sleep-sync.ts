import { Sleep } from '../core/sleeps/sleep.models';
import { fakeLiveSync } from './live-sync';

/** A stand-in for `SleepSyncService` (see `fakeLiveSync`). */
export const fakeSleepSync = (initial: readonly Sleep[] = []) => fakeLiveSync<Sleep>(initial);
