import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { applyQueuedSleeps } from './sleep';
import { Sleep } from './sleep.models';
import { SleepService } from './sleep.service';

/**
 * The live sleeps of every baby, shared by every device (spec 06), on the shared live-entries sync.
 * Timer taps and edits kept on the device (offline) are applied on top of what the server said, as
 * the server will apply them: a sleep started offline runs and shows at once, also after the app was
 * reopened, until the queue has reached the server.
 */
@Injectable({ providedIn: 'root' })
export class SleepSyncService extends LiveEntriesSync<Sleep> {
  private readonly sleeps = inject(SleepService);

  protected load(): Observable<Sleep[]> {
    return this.sleeps.inProgress();
  }

  protected override readonly overlay = applyQueuedSleeps;
}
