import { Injectable } from '@angular/core';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { applyQueuedPumps } from './pump';
import { Pump } from './pump.models';

/**
 * The live pumping sessions of every baby, shared by every device (spec 08), on the shared
 * live-entries sync (the `pumps` list of `/api/live`). Timer taps and edits kept on the device
 * (offline) are applied on top of what the server said, as the server will apply them: a session
 * started offline runs and shows at once, also after the app was reopened, until the queue has
 * reached the server.
 */
@Injectable({ providedIn: 'root' })
export class PumpSyncService extends LiveEntriesSync<Pump> {
  constructor() {
    super('pumps');
  }

  protected override readonly overlay = applyQueuedPumps;
}
