import { Injectable } from '@angular/core';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { Pump } from './pump.models';

/**
 * The live pumping sessions of every baby, shared by every device (spec 08), on the shared
 * live-entries sync (the `pumps` list of `/api/live`).
 */
@Injectable({ providedIn: 'root' })
export class PumpSyncService extends LiveEntriesSync<Pump> {
  constructor() {
    super('pumps');
  }
}
