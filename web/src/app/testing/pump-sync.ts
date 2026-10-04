import { Pump } from '../core/pumps/pump.models';
import { fakeLiveSync } from './live-sync';

/** A stand-in for `PumpSyncService` (see `fakeLiveSync`). */
export const fakePumpSync = (initial: readonly Pump[] = []) => fakeLiveSync<Pump>(initial);
