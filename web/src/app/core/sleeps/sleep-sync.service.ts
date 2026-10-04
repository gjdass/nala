import { Injectable } from '@angular/core';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { applyQueuedSleeps } from './sleep';
import { Sleep } from './sleep.models';

/**
 * The live sleeps of every baby, shared by every device (spec 06), on the shared live-entries sync (the `sleeps` list of `/api/live`).
 * Timer taps and edits kept on the device (offline) are applied on top of what the server said, as
 * the server will apply them: a sleep started offline runs and shows at once, also after the app was
 * reopened, until the queue has reached the server.
 */
@Injectable({ providedIn: 'root' })
export class SleepSyncService extends LiveEntriesSync<Sleep> {
  constructor() {
    super('sleeps');
  }

  protected override readonly overlay = applyQueuedSleeps;
}
