import { Injectable } from '@angular/core';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { applyQueued } from './breastfeed';
import { Feed } from './feed.models';

/**
 * The live breastfeeds of every baby, shared by every device (spec 05), on the shared live-entries
 * sync (the `feeds` list of `/api/live`). Timer taps kept on the device (offline) are applied on top of what the server said, as the
 * server will apply them: a breastfeed started offline runs and shows at once, also after the app was
 * reopened, until the queue has reached the server.
 */
@Injectable({ providedIn: 'root' })
export class BreastfeedSyncService extends LiveEntriesSync<Feed> {
  constructor() {
    super('feeds');
  }

  protected override readonly overlay = applyQueued;
}
