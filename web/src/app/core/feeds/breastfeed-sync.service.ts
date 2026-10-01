import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { applyQueued } from './breastfeed';
import { Feed } from './feed.models';
import { FeedService } from './feed.service';

/**
 * The live breastfeeds of every baby, shared by every device (spec 05), on the shared live-entries
 * sync. Timer taps kept on the device (offline) are applied on top of what the server said, as the
 * server will apply them: a breastfeed started offline runs and shows at once, also after the app was
 * reopened, until the queue has reached the server.
 */
@Injectable({ providedIn: 'root' })
export class BreastfeedSyncService extends LiveEntriesSync<Feed> {
  private readonly feeds = inject(FeedService);

  protected load(): Observable<Feed[]> {
    return this.feeds.inProgress();
  }

  protected override readonly overlay = applyQueued;
}
